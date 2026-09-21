import * as Three from 'three';
import Scene from "./Scene.js";
import RAPIER from '@dimforge/rapier3d-compat'
import { io } from 'socket.io-client';
import { type DummyJet } from './jet.js';
import { E } from './utils.js';


const socket = io();

//SERVER
let glScene: Scene = new Scene();
let clients: Map<string, DummyJet> = new Map();
let id: string;


await RAPIER.init();



glScene.on("userMoved", ()=>{
    socket.emit("move", [glScene.player?.model?.position.x, glScene.player?.model?.position.y, glScene.player?.model?.position.z])
});


socket.on("introduction", (_id: string, clientsCount: number, ids: string[]) =>{

    id = _id; //important for load players check

    glScene.loadJetModel().then((gltf) => { //model loading is async
        glScene.jetModel = gltf;
        glScene.initWorld(); //world needs jet model to aovid issues
        id = _id;
        
    });

    loadPlayers(ids)

});

function loadPlayers(ids: string[])
{
    for (let i = 0; i < ids.length; i++)
    {
        if (ids[i] != id) //do not add player to clients, creates unnecessary dummy model
        {   
            const currentId: string | undefined = ids[i];
            if (currentId == undefined) break;

            glScene.loadJetModel().then((gltf) => { //each player needs to load model again. for some reason gltf is three js scene obj and not model template
                clients.set(currentId, glScene.createdummyPlayer(gltf));
            });
        }
    }
}

socket.on("newUserConnected", (clientCount, _id) => {
   if (_id == id) return;

    glScene.loadJetModel().then((gltf) => { //load players async.
        clients.set(_id, glScene.createdummyPlayer(gltf));
    });
});

socket.on("userDisconnected", (clientCount, _id, ids) => {
    if (_id != id)
    {
        const model = clients.get(id)?.model;
        const rb = clients.get(id)?.rigidbody;

        if (model !== undefined)
        {
            glScene.scene.remove(model);
            glScene.world.removeRigidBody(rb)
            clients.delete(id);
        }
    }
});


socket.on("userPositions",  (clientProps) => {    
    const clientKeys: string[] = Object.keys(clientProps);
    
    for (let i = 0; i < clientKeys.length; i++)
    {
        if (clientKeys[i] != id)
        {
            const currentInspected: string | undefined = clientKeys[i];
            if (currentInspected == undefined) break;

            let oldPos: Three.Vector3 | undefined = clients.get(currentInspected)?.model?.position;
            let newPos: number[] = clientProps[currentInspected].position;

            let lerpPos = new Three.Vector3();
            
            if (oldPos && newPos)
            {
                lerpPos.x = Three.MathUtils.lerp(oldPos.x, newPos[0] ?? 0, 0.3);
                lerpPos.y = Three.MathUtils.lerp(oldPos.y, newPos[1] ?? 0, 0.3);
                lerpPos.z = Three.MathUtils.lerp(oldPos.z, newPos[2] ?? 0, 0.3);

            }

            clients.get(currentInspected)?.model?.position.set(lerpPos.x, lerpPos.y, lerpPos.z);
            clients.get(currentInspected)?.rigidbody.setTranslation(lerpPos);
        }   
    }
});


socket.on("connect", () => {});
