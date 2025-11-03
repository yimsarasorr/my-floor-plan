import { Component, ElementRef, ViewChild, AfterViewInit, HostListener } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import floorData from './floor-plan-data.json'; 

// --- TypeScript Interfaces สำหรับโครงสร้าง JSON ---
interface Vector2 {
  x: number;
  y: number;
}

interface Boundary {
  min: Vector2;
  max: Vector2;
}

interface Area {
  id: string;
  color: string;
  boundary: Boundary;
}

interface Wall {
  start: Vector2;
  end: Vector2;
}

interface FloorObject {
  id: string;
  type: string;
  position?: Vector2;
  width?: number;
  start?: Vector2;
  end?: Vector2;
}

interface FloorPlanData {
  areas: Area[];
  objects: FloorObject[];
  walls: Wall[];
}

@Component({
  selector: 'app-floor-plan',
  templateUrl: './floor-plan.component.html',
  styleUrls: ['./floor-plan.component.css']
})
export class FloorPlanComponent implements AfterViewInit {

  @ViewChild('canvas') private canvasRef!: ElementRef;

  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;

  private wallHeight = 2.8;
  private doorHeight = 2.4;
  private doorThickness = 0.2;
  private wallThickness = 0.15;
  private frustumSize = 30;
  private windowThickness = 0.2;

  ngAfterViewInit(): void {
    this.createScene();
    this.loadFloorPlan(floorData as FloorPlanData);
    this.startRenderingLoop();
  }

  private get canvas(): HTMLCanvasElement {
    return this.canvasRef.nativeElement;
  }

  private createScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    this.camera = new THREE.OrthographicCamera(
      this.frustumSize * aspect / -2, this.frustumSize * aspect / 2, this.frustumSize / 2, this.frustumSize / -2, 1, 1000
    );
    this.camera.position.set(10, 20, 10);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(10, 0, 10);
  }

  private loadFloorPlan(data: FloorPlanData): void {
    const floorGroup = new THREE.Group();
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });

    data.areas.forEach(area => {
      const width = area.boundary.max.x - area.boundary.min.x;
      const depth = area.boundary.max.y - area.boundary.min.y;
      const floorGeo = new THREE.PlaneGeometry(width, depth);
      const floorMat = new THREE.MeshStandardMaterial({ color: area.color, side: THREE.DoubleSide });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(area.boundary.min.x + width / 2, 0, area.boundary.min.y + depth / 2);
      floor.receiveShadow = true;
      floorGroup.add(floor);
    });
    
    data.walls.forEach(wall => {
      const start = new THREE.Vector3(wall.start.x, 0, wall.start.y);
      const end = new THREE.Vector3(wall.end.x, 0, wall.end.y);
      const wallMesh = this.buildLineMesh(start, end, this.wallHeight, this.wallThickness, wallMaterial);
      wallMesh.castShadow = true;
      floorGroup.add(wallMesh);
    });

    data.objects.forEach(obj => {
      const objectType = obj.type.toLowerCase();

      if (objectType === 'window' && obj.start && obj.end) {
        const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.6 });
        const start = new THREE.Vector3(obj.start.x, 0, obj.start.y);
        const end = new THREE.Vector3(obj.end.x, 0, obj.end.y);
        const windowMesh = this.buildLineMesh(start, end, 1.2, this.windowThickness, windowMaterial);
        windowMesh.position.y = 1.0 + (1.2 / 2);
        floorGroup.add(windowMesh);
      }
      
      if (objectType === 'door' && obj.start && obj.end) {
        const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const start = new THREE.Vector3(obj.start.x, 0, obj.start.y);
        const end = new THREE.Vector3(obj.end.x, 0, obj.end.y);
        // --- ปรับความหนาประตูให้เท่ากับกำแพง ---
        const doorMesh = this.buildLineMesh(start, end, this.doorHeight, this.doorThickness, doorMaterial);
        doorMesh.castShadow = true;
        floorGroup.add(doorMesh);
      }
    });

    this.scene.add(floorGroup);
    
    const gridHelper = new THREE.GridHelper(50, 50);
    this.scene.add(gridHelper);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(15, 20, 10);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);
  }

  private buildLineMesh(start: THREE.Vector3, end: THREE.Vector3, height: number, thickness: number, material: THREE.Material): THREE.Mesh {
    const distance = start.distanceTo(end);
    const isHorizontal = Math.abs(end.x - start.x) > Math.abs(end.z - start.z);
    
    const width = isHorizontal ? distance : thickness;
    const depth = isHorizontal ? thickness : distance;

    const geometry = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geometry, material);

    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mesh.position.set(midPoint.x, height / 2, midPoint.z);

    return mesh;
  }

  private startRenderingLoop(): void {
    const render = () => {
      requestAnimationFrame(render);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    render();
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize(event: Event) {
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    this.camera.left = this.frustumSize * aspect / -2;
    this.camera.right = this.frustumSize * aspect / 2;
    this.camera.top = this.frustumSize / 2;
    this.camera.bottom = this.frustumSize / -2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
  }
}