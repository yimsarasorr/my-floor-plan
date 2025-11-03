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
  boundary?: Boundary;
  points?: Vector2[];
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
    this.camera.position.set(0, 30, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enableRotate = false;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
  }

  private loadFloorPlan(data: FloorPlanData): void {
    const floorGroup = new THREE.Group();
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });

    const bounds = {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    };

    const includePoint = (point: Vector2) => {
      bounds.minX = Math.min(bounds.minX, point.x);
      bounds.maxX = Math.max(bounds.maxX, point.x);
      bounds.minY = Math.min(bounds.minY, point.y);
      bounds.maxY = Math.max(bounds.maxY, point.y);
    };

    data.areas.forEach(area => {
      const floorMat = new THREE.MeshStandardMaterial({ color: area.color, side: THREE.DoubleSide });

      if (area.points && area.points.length >= 3) {
        const shape = new THREE.Shape();
        const [first, ...rest] = area.points;
        shape.moveTo(first.x, first.y);
        rest.forEach(point => shape.lineTo(point.x, point.y));
        shape.lineTo(first.x, first.y);
        area.points.forEach(includePoint);

        const floorGeo = new THREE.ShapeGeometry(shape);
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        floorGroup.add(floor);
      } else if (area.boundary) {
        includePoint(area.boundary.min);
        includePoint(area.boundary.max);

        const width = area.boundary.max.x - area.boundary.min.x;
        const depth = area.boundary.max.y - area.boundary.min.y;
        const floorGeo = new THREE.PlaneGeometry(width, depth);
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(area.boundary.min.x + width / 2, 0, area.boundary.min.y + depth / 2);
        floor.receiveShadow = true;
        floorGroup.add(floor);
      }
    });

    data.walls.forEach(wall => {
      const start = new THREE.Vector3(wall.start.x, 0, wall.start.y);
      const end = new THREE.Vector3(wall.end.x, 0, wall.end.y);
      includePoint(wall.start);
      includePoint(wall.end);
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
        includePoint(obj.start);
        includePoint(obj.end);
        const windowMesh = this.buildLineMesh(start, end, 1.2, this.windowThickness, windowMaterial);
        windowMesh.position.y = 1.0 + (1.2 / 2);
        floorGroup.add(windowMesh);
      }

      if (objectType === 'door' && obj.start && obj.end) {
        const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const start = new THREE.Vector3(obj.start.x, 0, obj.start.y);
        const end = new THREE.Vector3(obj.end.x, 0, obj.end.y);
        includePoint(obj.start);
        includePoint(obj.end);
        const doorMesh = this.buildLineMesh(start, end, this.doorHeight, this.wallThickness, doorMaterial);
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

    if (bounds.minX !== Number.POSITIVE_INFINITY) {
      this.configureCamera(bounds);
    }
  }

  private configureCamera(bounds: { minX: number; maxX: number; minY: number; maxY: number; }): void {
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxY - bounds.minY;
    const maxDimension = Math.max(width, depth);
    this.frustumSize = Math.max(20, maxDimension * 1.6);
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    this.camera.left = -this.frustumSize * aspect / 2;
    this.camera.right = this.frustumSize * aspect / 2;
    this.camera.top = this.frustumSize / 2;
    this.camera.bottom = -this.frustumSize / 2;
    this.camera.updateProjectionMatrix();

    const center = new THREE.Vector3(bounds.minX + width / 2, 0, bounds.minY + depth / 2);
    const isoDistance = Math.max(maxDimension, 12);
    this.camera.position.set(center.x + isoDistance, isoDistance, center.z + isoDistance);
    this.controls.target.copy(center);
    this.controls.update();
  }

  private buildLineMesh(start: THREE.Vector3, end: THREE.Vector3, height: number, thickness: number, material: THREE.Material): THREE.Mesh {
    const distance = start.distanceTo(end);
    const geometry = new THREE.BoxGeometry(distance, height, thickness);
    const mesh = new THREE.Mesh(geometry, material);

    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mesh.position.set(midPoint.x, height / 2, midPoint.z);

    const direction = new THREE.Vector3().subVectors(end, start);
    const angle = Math.atan2(direction.z, direction.x);
    mesh.rotation.y = angle;

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