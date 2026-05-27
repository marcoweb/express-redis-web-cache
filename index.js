const express = require("express");
const sqlite3 = require("sqlite3");
const redis = require("redis");

const app = express();
app.use(express.json());

const db = new sqlite3.Database("banco.db");

const redisClient = redis.createClient({
    url: "redis://localhost:6379"
});

db.serialize(() =>{
    db.run(`
        CREATE TABLE IF NOT EXISTS tarefas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT NOT NULL,
            concluido BOOLEAN DEFAULT 0
        )
    `);
});

redisClient.connect();

app.post("/tarefas", async (req, res) => {
    const { titulo } = req.body;

    db.run(
        'INSERT INTO tarefas (titulo, concluido) VALUES (?, ?)',
        [titulo, 0],
        async function (erro) {
            if(erro) {
                return res.status(500).json({
                    erro : "Erro ao cadastrar tarefa"
                });
            }

            await redisClient.del("tarefas");

            res.status(201).json({
                id: this.lastID,
                titulo,
                concluido: false
            });
        }
    );
});

app.get("/tarefas", async (req, res) => {
    const cache = await redisClient.get("tarefas");

    if(cache) {
        return res.json({
            origem: "redis",
            dados: JSON.parse(cache)
        });
    }

    db.all(
        'SELECT * FROM tarefas',
        [],
        async (erro, linhas) => {
            if(erro) {
                return res.status(500).json({
                    erro : "Erro ao consultar tarefas"
                });
            }

            await redisClient.setEx("tarefas", 30, JSON.stringify(linhas));

            res.json({
                origem: "SQLite",
                dados: linhas
            });
        }
    );
});

app.listen(3000, () => {
    console.log("Servidor executando em localhost");
});
