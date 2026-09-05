import express from 'express';
import { createServer, IncomingMessage, ServerResponse} from 'node:http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';
import path, { dirname, join } from 'node:path';
import ejs from 'ejs';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const app = express();
const server = createServer(app);
const io = new Server(server);

//setup views folder
app.set("views", __dirname + "/views");

//setup ejs
app.engine(".html", ejs.__express);
app.set("view-engine", "html");

//public client folder
app.use(express.static(__dirname + "/public"));


server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});


let clients = {};

io.on("connection", (client) =>{ //server side
    console.log("User" + client.id + " connected. There are " + io.engine.clientsCount + " clients connected.");

    //make new client with id as index
    clients[client.id] = {
      position: [0, 0, 0],
      rotation: [0, 0, 0]
    };
    //send id back to user
    client.emit("new", client.id, io.engine.clientsCount, Object.keys(clients));
    //update all players of new player
    io.sockets.emit("newUserConnected", io.engine.clientsCount, client.id, Object.keys(clients));


    client.on("move", (pos)=>{ //if this specific client moves, update server client data and send it to all other clients to synchronise
      clients[client.id].position = pos;
      io.sockets.emit("userPositions", clients);
    });


    client.on("disconnect", () => {
      delete clients[client.id];

      io.sockets.emit("userDisconnected", io.engine.clientsCount, client.id, Object.keys(clients));

      console.log("User" + client.id + " discconnected. There are " + io.engine.clientsCount + " clients connected.");
    });
});


app.get('/', (req, res) => { //client side
  res.render("index.html");
});
