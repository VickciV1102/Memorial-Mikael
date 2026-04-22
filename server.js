const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar Express para aceitar grandes payloads de imagem (base64)
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// Servir arquivos estáticos do frontend (na mesma pasta)
app.use(express.static(path.join(__dirname)));

// Configurar Banco de Dados SQLite
const db = new sqlite3.Database('./memories.db', (err) => {
    if (err) {
        console.error('Erro ao abrir o banco de dados', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');
        db.run(`CREATE TABLE IF NOT EXISTS memories (
            id TEXT PRIMARY KEY,
            author TEXT,
            message TEXT,
            image TEXT,
            likes INTEGER DEFAULT 0,
            date TEXT
        )`, (err) => {
            if (err) {
                console.error('Erro ao criar tabela:', err);
            } else {
                // Tabela criada com sucesso
            }
        });
    }
});

// Rotas da API

// GET /api/memories - Buscar todas as memórias
app.get('/api/memories', (req, res) => {
    db.all("SELECT * FROM memories ORDER BY date DESC", [], (err, rows) => {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        res.json({
            "message": "success",
            "data": rows
        });
    });
});

// POST /api/memories - Criar nova memória
app.post('/api/memories', (req, res) => {
    const { author, message, image } = req.body;
    const id = Date.now().toString();
    const date = new Date().toISOString();
    const likes = 0;

    db.run("INSERT INTO memories (id, author, message, image, likes, date) VALUES (?, ?, ?, ?, ?, ?)",
        [id, author, message, image, likes, date],
        function (err) {
            if (err) {
                res.status(400).json({ "error": err.message });
                return;
            }
            res.json({
                "message": "success",
                "data": { id, author, message, image, likes, date }
            });
        });
});

// POST /api/memories/:id/like - Curtir uma memória
app.post('/api/memories/:id/like', (req, res) => {
    const { id } = req.params;
    const { action } = req.body; // 'like' ou 'unlike'
    
    const modifier = action === 'like' ? '+ 1' : '- 1';

    db.run(`UPDATE memories SET likes = CASE WHEN likes > 0 OR '${action}' = 'like' THEN likes ${modifier} ELSE 0 END WHERE id = ?`, [id], function(err) {
        if (err) {
            res.status(400).json({ "error": err.message });
            return;
        }
        // Obter os likes atualizados
        db.get("SELECT likes FROM memories WHERE id = ?", [id], (err, row) => {
            res.json({ "message": "success", "likes": row ? row.likes : 0 });
        });
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
