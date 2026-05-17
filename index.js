const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Configuración de la conexión
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', // En XAMPP suele estar vacío
    database: 'bille_db'
});

db.connect((err) => {
    if (err) {
        console.error('Error conectando a la base de datos:', err);
        return;
    }
    console.log('¡Conectado exitosamente a la base de datos de Bille!');
});

// Endpoint: POST /registro-completo 
app.post('/registro-completo', (req, res) => {
    const { username, email, password, presupuesto, limites } = req.body;

    // 1. VALIDACIÓN
    const sumaLimites = Object.values(limites).reduce((a, b) => a + b, 0);
    if (sumaLimites > presupuesto) {
        return res.status(400).json({ 
            error: "La suma de los límites no puede exceder el presupuesto global." 
        });
    }

    // 2. INSERTAR USUARIO
    const queryUser = "INSERT INTO usuarios (username, email, password, presupuesto, alerta_limite, reporte_semanal) VALUES (?, ?, ?, ?, 1, 0)";
    
    db.query(queryUser, [username, email, password, presupuesto], (err, userResult) => {
        if (err) {
            console.error("Error al insertar usuario:", err);
            return res.status(500).json({ error: "Error al crear el usuario" });
        }

        const nuevoUsuarioId = userResult.insertId;

        // 3. INSERTAR LÍMITES POR CATEGORÍA
        const valoresLimites = Object.entries(limites).map(([categoria, monto]) => [
            nuevoUsuarioId, 
            categoria, 
            monto
        ]);

        const queryLimites = "INSERT INTO limites_categoria (usuario_id, categoria, limite_mensual) VALUES ?";
        
        db.query(queryLimites, [valoresLimites], (errLimites, resultLimites) => {
            if (errLimites) {
                console.error("Error al insertar límites:", errLimites);
                return res.status(500).json({ error: "Usuario creado, pero hubo un error con los límites" });
            }

            res.status(201).json({ 
                message: "Usuario y límites creados con éxito", 
                usuarioId: nuevoUsuarioId 
            });
        });
    });
});

// Ruta para registrar un usuario
app.post('/registrar', (req, res) => {
    const { username, password, email } = req.body;

    // Validación simple
    if (!username || !password || !email) {
        return res.status(400).json({ error: 'Por favor, llena todos los campos' });
    }

    const query = 'INSERT INTO usuarios (username, password, email) VALUES (?, ?, ?)';
    
    db.query(query, [username, password, email], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'El usuario o email ya existe' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ mensaje: '¡Usuario de Bille creado con éxito!', id: result.insertId });
    });
});

// Ruta para iniciar sesión (Log-in)
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Faltan credenciales (email y password)' });
    }

    const query = 'SELECT * FROM usuarios WHERE email = ? AND password = ?';

    db.query(query, [email, password], (err, results) => {
        if (err) {
            console.error("Error en la base de datos:", err);
            return res.status(500).json({ error: err.message });
        }

        if (results.length > 0) {
            res.json({
                mensaje: '¡Bienvenido a Bille!',
                id: results[0].id, 
                nombre: results[0].username
            });
        } else {
            res.status(401).json({ error: 'Correo o contraseña incorrectos' });
        }
    });
});

// Ruta para registrar un gasto
app.post('/gastos', (req, res) => {
    // 1. Ahora incluimos 'fecha' en la desestructuración
    const { usuario_id, descripcion, monto, categoria, fecha } = req.body;

    // 2. Validamos 
    if (!usuario_id || !descripcion || !monto || !fecha) {
        return res.status(400).json({ error: 'Faltan datos obligatorios, incluyendo la fecha' });
    }

    const query = 'INSERT INTO gastos (usuario_id, descripcion, monto, categoria, fecha) VALUES (?, ?, ?, ?, ?)';

    // 3. Pasamos los 5 parámetros en orden
    db.query(query, [usuario_id, descripcion, monto, categoria, fecha], (err, result) => {
        if (err) {
            console.error("Error al insertar gasto:", err);
            return res.status(500).json({ error: err.message });
        }
        
        res.status(201).json({ 
            mensaje: 'Gasto registrado en Bille', 
            id_gasto: result.insertId 
        });
    });
});

// Ruta para obtener todos los gastos de un usuario específico
app.get('/gastos/:usuario_id', (req, res) => {
    const { usuario_id } = req.params;

    // Ordenamos por fecha descendente
    const query = 'SELECT * FROM gastos WHERE usuario_id = ? ORDER BY fecha DESC';

    db.query(query, [usuario_id], (err, results) => {
        if (err){ 
            console.error("Error al obtener gastos: ", err);
            return res.status(500).json({ error: err.message });
    
        }

        res.json(results);
    });
});

// === AGREGA ESTE NUEVO ENDPOINT AQUÍ ABAJO ===
// Ruta exclusiva para el Dashboard: Obtener solo los 5 gastos más recientes
app.get('/gastos/recientes/:usuario_id', (req, res) => {
    const { usuario_id } = req.params;

    // Limitamos la consulta de SQL a solo 5 resultados
    const query = 'SELECT * FROM gastos WHERE usuario_id = ? ORDER BY fecha DESC LIMIT 5';

    db.query(query, [usuario_id], (err, results) => {
        if (err) { 
            console.error("Error al obtener gastos recientes: ", err);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// Ruta para actualizar el presupuesto inicial del usuario
app.put('/usuarios/presupuesto', (req, res) => {
    const { usuario_id, presupuesto } = req.body;

    if (!usuario_id || presupuesto === undefined) {
        return res.status(400).json({ error: 'Faltan datos' });
    }

    const query = 'UPDATE usuarios SET presupuesto = ? WHERE id = ?';

    db.query(query, [presupuesto, usuario_id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: 'Presupuesto actualizado con éxito' });
    });
});

// Obtener el Saldo Disponible Real (Presupuesto - Suma de Gastos del Mes)
app.get('/usuarios/saldo/:usuario_id', (req, res) => {
    const { usuario_id } = req.params;

    const query = `
        SELECT 
            (u.presupuesto - IFNULL(SUM(g.monto), 0)) as saldo_disponible
        FROM usuarios u
        LEFT JOIN gastos g ON u.id = g.usuario_id 
            AND MONTH(g.fecha) = MONTH(CURRENT_DATE()) 
            AND YEAR(g.fecha) = YEAR(CURRENT_DATE())
        WHERE u.id = ?
    `;

    db.query(query, [usuario_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Retornamos directamente el valor numérico o 0 si no se encuentra
        const saldo = results[0] ? results[0].saldo_disponible : 0;
        res.json({ saldo_disponible: saldo });
    });
});

// Obtener configuración actual del usuario
app.get('/configuracion/:id', (req, res) => {
    const query = 'SELECT alerta_limite, reporte_semanal, presupuesto FROM usuarios WHERE id = ?';
    db.query(query, [req.params.id], (err, result) => {
        if (err) {
            console.error("Error al obtener configuración:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json(result[0]);
    });
});

// Guardar nueva configuración
app.post('/configuracion', (req, res) => {
    // Recibimos 'presupuesto' tal cual está en tu base de datos
    const { id, alerta_limite, reporte_semanal, presupuesto } = req.body;
    
    const query = 'UPDATE usuarios SET alerta_limite = ?, reporte_semanal = ?, presupuesto = ? WHERE id = ?';
    
    db.query(query, [alerta_limite, reporte_semanal, presupuesto, id], (err, result) => {
        if (err) {
            console.error("Error al actualizar configuración:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ mensaje: 'Configuración actualizada en Bille' });
    });
});

app.listen(3000, () => {
    console.log('Servidor de Bille escuchando en el puerto 3000');
});