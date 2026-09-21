import express from 'express';
import { createServer} from 'node:http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';
import path, { dirname, join } from 'node:path';
import ejs from 'ejs';
import http from "http"


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
const server = http.createServer(app);
const io = new Server(server);


//setup ejs
app.engine(".html", ejs.__express);
app.set("view engine", "html");
//setup views folder
app.set("views",path.join(__dirname, "/views"));
//public client folder
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "dist")));
//src folder
app.use(express.static(path.join(__dirname, "src")));


let clients = new Object();

app.get('/', (req, res) => { //client side
  res.render(path.join(__dirname, "views/index.html"));
});

io.on('connection', (client) =>{ //server side
    console.log("User-" + client.id + " connected. There are " + io.engine.clientsCount + " clients connected.");

    //make new client with id as index
    clients[client.id] = {
      position: [0, 0, 0],
      rotation: [0, 0, 0]
    };

    const clientKeys = Object.keys(clients);

    //send id back to user
    client.emit("introduction", client.id, io.engine.clientsCount, clientKeys);
    //update all players of new player
    io.sockets.emit("newUserConnected", io.engine.clientsCount, client.id);


    client.on("move", (pos)=>{ //if this specific client moves, update server client data and send it to all other clients to synchronise
      clients[client.id].position = pos;
      io.sockets.emit("userPositions", clients);
    });


    client.on("disconnect", () => {
      delete clients[client.id];

      io.sockets.emit("userDisconnected", io.engine.clientsCount, client.id, clientKeys);

      console.log("User" + client.id + " discconnected. There are " + io.engine.clientsCount + " clients connected.");
    });
});

server.listen(PORT, HOST,() => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});



