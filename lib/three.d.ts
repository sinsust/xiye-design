// Minimal ambient declaration so TypeScript compiles without @types/three.
// The originkit components (particle-sphere, image-grid) only import a small
// subset at runtime. Each symbol is typed `any` and exposed as both a value
// (`const`) and a type (`type`), so components can `new X()` and also use `X`
// as a type annotation for fields/params.

declare module "three" {
  export const Scene: any;
  export type Scene = any;
  export const PerspectiveCamera: any;
  export type PerspectiveCamera = any;
  export const OrthographicCamera: any;
  export type OrthographicCamera = any;
  export const PlaneGeometry: any;
  export type PlaneGeometry = any;
  export const ShaderMaterial: any;
  export type ShaderMaterial = any;
  export const WebGLRenderer: any;
  export type WebGLRenderer = any;
  export const Color: any;
  export type Color = any;
  export const Points: any;
  export type Points = any;
  export const BufferGeometry: any;
  export type BufferGeometry = any;
  export const Float32BufferAttribute: any;
  export type Float32BufferAttribute = any;
  export const PointsMaterial: any;
  export type PointsMaterial = any;
  export const SphereGeometry: any;
  export type SphereGeometry = any;
  export const MeshBasicMaterial: any;
  export type MeshBasicMaterial = any;
  export const InstancedMesh: any;
  export type InstancedMesh = any;
  export const Mesh: any;
  export type Mesh = any;
  export const Matrix4: any;
  export type Matrix4 = any;
  export const Group: any;
  export type Group = any;
  export const Vector2: any;
  export type Vector2 = any;
  export const Vector3: any;
  export type Vector3 = any;
  export const AdditiveBlending: any;
  export const Texture: any;
  export type Texture = any;
  export const TextureLoader: any;
  export type TextureLoader = any;
  export const LinearMipmapLinearFilter: any;
}