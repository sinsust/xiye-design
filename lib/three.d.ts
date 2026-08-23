// Minimal ambient declaration so TypeScript compiles without @types/three.
// The originkit particle-sphere components only import a small subset at runtime.

declare module "three" {
  export const Scene: any;
  export const PerspectiveCamera: any;
  export const WebGLRenderer: any;
  export const Color: any;
  export const Points: any;
  export const BufferGeometry: any;
  export const Float32BufferAttribute: any;
  export const PointsMaterial: any;
  export const SphereGeometry: any;
  export const MeshBasicMaterial: any;
  export const InstancedMesh: any;
  export const Mesh: any;
  export const Matrix4: any;
  export const Group: any;
  export const Vector3: any;
  export const AdditiveBlending: any;
}
