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
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Faltan credenciales' });
    }

    const query = 'SELECT * FROM usuarios WHERE username = ? AND password = ?';

    db.query(query, [username, password], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        if (results.length > 0) {
            res.json({
                mensaje: '¡Bienvenido a Bille!',
                usuario: results[0].username
            });
        } else {
            res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
    });
});

// Ruta para registrar un nuevo gasto
app.post('/gastos', (req, res) => {
    const { usuario_id, descripcion, monto, categoria } = req.body;

    if (!usuario_id || !descripcion || !monto) {
        return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    const query = 'INSERT INTO gastos (usuario_id, descripcion, monto, categoria) VALUES (?, ?, ?, ?)';

    db.query(query, [usuario_id, descripcion, monto, categoria], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        
        res.status(201).json({ 
            mensaje: 'Gasto registrado en Bille', 
            id_gasto: result.insertId 
        });
    });
});

// Ruta para obtener todos los gastos de un usuario específico
app.get('/gastos/:usuario_id', (req, res) => {
    const { usuario_id } = req.params;

    // Ordenamos por fecha descendente para que los más recientes salgan primero
    const query = 'SELECT * FROM gastos WHERE usuario_id = ? ORDER BY fecha DESC';

    db.query(query, [usuario_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

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

// Calculo de Saldo Disponible
app.get('/usuarios/saldo/:usuario_id', (req, res) => {
    const { usuario_id } = req.params;

    // Esta consulta filtra los gastos para que solo sume los del MES y AÑO actual
    const query = `
        SELECT 
            u.presupuesto, 
            IFNULL(SUM(g.monto), 0) as gastos_del_mes,
            (u.presupuesto - IFNULL(SUM(g.monto), 0)) as saldo_disponible
        FROM usuarios u
        LEFT JOIN gastos g ON u.id = g.usuario_id 
            AND MONTH(g.fecha) = MONTH(CURRENT_DATE()) 
            AND YEAR(g.fecha) = YEAR(CURRENT_DATE())
        WHERE u.id = ?
    `;

    db.query(query, [usuario_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results[0]);
    });
});

app.listen(3000, () => {
    console.log('Servidor de Bille escuchando en el puerto 3000');
});