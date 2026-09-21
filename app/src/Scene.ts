import * as Three from 'three';
import { OrbitControls} from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { Jet, type DummyJet } from './jet.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { generateMap } from './map.js';
import { RapierDebugRenderer } from './rapierDebugRenderer.js';
import RAPIER from '@dimforge/rapier3d-compat'
import { EffectComposer, OutputPass, PointerLockControls, RenderPass} from 'three/examples/jsm/Addons.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';
import {EventEmitter} from "events";


export default class Scene extends EventEmitter{
        //THREE JS
        scene: Three.Scene = new Three.Scene();
        loader: GLTFLoader = new GLTFLoader();
        camera: Three.PerspectiveCamera = new Three.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000); 
        renderer:Three.WebGLRenderer = new Three.WebGLRenderer();
        composer: EffectComposer = new EffectComposer(this.renderer);
        orbitControls: OrbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        keysPressed: any = {};
        stats: Stats = new Stats();
        controls: PointerLockControls = new PointerLockControls(this.camera,this.renderer.domElement);
        player?: Jet;
        mouse: Three.Vector2 = new Three.Vector2;
        jetModel: GLTF | undefined;

        //RAPIER 3D
        world: RAPIER.World;
        clock: Three.Timer = new Three.Timer();
        FPS: number = 1000 / 120; //1000 / FPS target
        //EVENTS
        eventQueue: any;
    
        //Rapier debug
        rapierDebugger?: RapierDebugRenderer;

        emitTime: number = 0.25;
        remainingEmitTime: number = 0.25;

    constructor(domElement = document.getElementById("gl_context")){
        super();

        //SCENE
        this.scene.background = new Three.Color(0xa8def0);
        //CAMERA
        this.camera.position.set(0, 1, -5);  

        //RENDERER
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        
        domElement?.appendChild(this.renderer.domElement);
        
        //POST-PROCCESSING 
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.composer.addPass(new RenderPixelatedPass(1, this.scene, this.camera));
        this.composer.addPass(new OutputPass());

        //LIGHTING
        const ambientLight = new Three.AmbientLight(0xffffff, 1);
        this.scene.add(ambientLight);
        
        //CONTROLS
        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.minDistance = 5;
        this.orbitControls.maxDistance = 5;
        this.orbitControls.minZoom = 1;
        this.orbitControls.maxZoom = 2;
        this.orbitControls.update();
        
        //CONTROL KEYS
        window.addEventListener('keydown', (event: KeyboardEvent) => {
            (this.keysPressed as any)[event.key.toLowerCase()] = true;  
        }, false);
        
        window.addEventListener('keyup', (event: KeyboardEvent) => {
            (this.keysPressed as any)[event.key.toLowerCase()] = false;  
        }, false);
        
        window.addEventListener("mousedown", (event: MouseEvent) => {
            (this.keysPressed as any)[event.button.toString()] = true;
        });
        
        window.addEventListener("mouseup", (event: MouseEvent) => {
            (this.keysPressed as any)[event.button.toString()] = false;
        });
        
        
        //MOUSE LOCK CONTROLS
        domElement?.addEventListener("click", () => {
            this.controls.lock();
        });
        domElement?.addEventListener("cancel", () => {
            this.controls.unlock();
        });


        window.addEventListener("resize", this.onWindowResize);
    }

    onWindowResize()
    {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    loadJetModel(): Promise<GLTF>
    {
        //load jet early to be accessible in time
        return new Promise((resolve) =>{
            this.loader.load('model/jet/jet.gltf', data => resolve(data));
        })
    }

    initWorld()
    {

        this.world = new RAPIER.World({x: 0, y: -9.81, z: 0})
        this.rapierDebugger = new RapierDebugRenderer(this.scene, this.world)
        this.eventQueue = new RAPIER.EventQueue(true);
        this.clock.connect(document);
        
        //MAP
        generateMap(this.scene, this.world);
        
        //PLAYER
        this.player = this.createPlayer();

        //FPS COUNTER
        this.stats.showPanel(0); //FPS  
        this.stats.dom.style.position = "absolute";
        this.stats.dom.style.left = (window.screen.width - 97).toString() + "px";
        this.stats.dom.style.top = "0px";

        document.body.appendChild(this.stats.dom);

        this.update();
    }

    async update()
    {
        requestAnimationFrame(() => this.update());

        this.stats.begin();
        this.world.step();
        let dt = this.clock.getDelta();

        if (this.player != undefined) 
        {
            this.player.update(dt, this.keysPressed, this.mouse);
        }

        this.world.forEachCollider((collider: RAPIER.Collider) =>{
            collider.activeCollisionTypes;
        });

        this.orbitControls.update();
        this.controls.update(dt);
        this.clock.update();
        this.stats.end();
        this.rapierDebugger?.update();

        //EVENTS
        this.world.step(this.eventQueue);

        this.eventQueue.drainCollisionEvents((handle1: number, handle2: number, started: boolean)=>{ 
            let isBullet1: boolean | undefined = this.player?.isActiveBullet(handle1);
            let isBullet2: boolean | undefined = this.player?.isActiveBullet(handle2);

            //This part removes bullet collider/rb from world 
            if (!isBullet1 && !isBullet2) return; //environmental collision, not bullet and other
            if (isBullet1 && isBullet2) //bullet on bullet, rare but needs handling
            {
                const colliderToRemove1 = this.world.getCollider(handle1);
                const colliderToRemove2 = this.world.getCollider(handle2);


                this.world.removeCollider(colliderToRemove1,true)
                this.world.removeRigidBody(this.world.getRigidBody(colliderToRemove1.parent()?.handle ?? 0)); //0 = undefined

                this.world.removeCollider(colliderToRemove2,true)
                this.world.removeRigidBody(this.world.getRigidBody(colliderToRemove2.parent()?.handle ?? 0));

            }
            else if (isBullet1 && !isBullet2) //first collider bullet and second collider plane/other jet
            {
                const colliderToRemove = this.world.getCollider(handle1);
                this.world.removeCollider(colliderToRemove,true)
                this.world.removeRigidBody(this.world.getRigidBody(colliderToRemove.parent()?.handle ?? 0));
                
            }else
            {
                const colliderToRemove = this.world.getCollider(handle2);
                this.world.removeCollider(colliderToRemove,true)
                this.world.removeRigidBody(this.world.getRigidBody(colliderToRemove.parent()?.handle ?? 0));
            }

        });

        this.renderer.render(this.scene,this.camera);

        //transmit player movement to server
        if (this.remainingEmitTime < 0)
        {
            this.emit("userMoved");
            this.remainingEmitTime = this.emitTime;
        } else this.remainingEmitTime -= dt;

        //////// TODO: Fix Composer pixelation ///////
        //this.composer.render();
    }



    public createPlayer(): Jet{

        let jet: Jet = new Jet();

        //const bodyBuilder = new RAPIER.RigidBodyDesc(RAPIER.RigidBodyType.Dynamic)
        //.setTranslation(0 + Math.random() * 500, 500, 0 + Math.random() * 500); //randomizes spawn location to avoid clipping
        const bodyBuilder = new RAPIER.RigidBodyDesc(RAPIER.RigidBodyType.Dynamic)
        const rigidBody = this.world.createRigidBody(bodyBuilder);
        const collider = RAPIER.ColliderDesc.cuboid(1.1, 0.2, 1.6)
              .setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.DEFAULT | RAPIER.ActiveCollisionTypes.KINEMATIC_KINEMATIC);
        
        this.world.createCollider(collider, rigidBody);

        if (this.jetModel == null) return jet;

        const jetModel = this.jetModel.scene;
        jetModel.scale.set(0.2,0.2,0.2);
        this.scene.add(jetModel);

        const gltfAnim: Three.AnimationClip[] = this.jetModel.animations;
        const mixer = new Three.AnimationMixer(jetModel);
        const animationsMap: Map<string, Three.AnimationAction> = new Map();
        gltfAnim.forEach((value: Three.AnimationClip) => {animationsMap.set(value.name, mixer.clipAction(value))});

        jet = new Jet.Builder()
            .setWorld(this.world)
            .setModel(jetModel)
            .setRigidBody(rigidBody)
            .setMixer(mixer)
            .setAnimationsMap(animationsMap)
            .setOrbitConrols(this.orbitControls)
            .setCamera(this.camera)
            .setCurrentAction("Idle")
            .build();

        return jet;
    }


    public createdummyPlayer(gltf: GLTF): DummyJet{

        const dummy: DummyJet = {
            model: undefined,
            rigidbody: undefined
        }

        const bodyBuilder = new RAPIER.RigidBodyDesc(RAPIER.RigidBodyType.KinematicVelocityBased)
        .setTranslation(0 + Math.random() * 500, 500, 0 + Math.random() * 500); //randomizes spawn location to avoid clipping

        const rigidBody = this.world.createRigidBody(bodyBuilder);
        const collider = RAPIER.ColliderDesc.cuboid(1.1, 0.2, 1.6)
              .setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.DEFAULT | RAPIER.ActiveCollisionTypes.KINEMATIC_KINEMATIC);
        
        this.world.createCollider(collider, rigidBody);

        if (this.jetModel == null) return dummy;

        const jetModel = gltf.scene;
        jetModel.scale.set(0.2,0.2,0.2);
        this.scene.add(jetModel);

        const gltfAnim: Three.AnimationClip[] = this.jetModel.animations;
        const mixer = new Three.AnimationMixer(jetModel);
        const animationsMap: Map<string, Three.AnimationAction> = new Map();
        gltfAnim.forEach((value: Three.AnimationClip) => {animationsMap.set(value.name, mixer.clipAction(value))});

        dummy.model = jetModel;
        dummy.rigidbody = rigidBody;

        return dummy;
    }

}