// Hand-written GLSL 100 lighting: three's built-in lit materials (MeshLambertMaterial,
// MeshStandardMaterial) are unproven on Hermes, and every 3D game in the team's monorepo lights by
// hand. MeshBasicMaterial (unlit) is fine as is.
import { Color, ShaderMaterial, Vector3 } from 'three';

export const LIGHT_DIR = new Vector3(0.4, 1, 0.6).normalize();
const AMBIENT = 0.45;

/** A number as a GLSL float literal, which needs its decimal point. */
const float = (value: number): string => value.toFixed(4);

const VERT = `
varying vec3 vNormal;
void main() {
	// mat3(mat4) is GLSL ES 3.00; build it from columns.
	vNormal = normalize(mat3(modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz) * normal);
	gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}`;

const FRAG = `
uniform vec3 uColor;
uniform vec3 uLightDir;
varying vec3 vNormal;
void main() {
	float light = ${float(AMBIENT)} + ${float(1 - AMBIENT)} * max(dot(normalize(vNormal), uLightDir), 0.0);
	gl_FragColor = vec4(uColor * light, 1.0);
	#include <colorspace_fragment>
}`;

export function createLambertMaterial(color: number): ShaderMaterial {
	return new ShaderMaterial({
		uniforms: { uColor: { value: new Color(color) }, uLightDir: { value: LIGHT_DIR } },
		vertexShader: VERT,
		fragmentShader: FRAG,
	});
}

export function setMaterialColor(material: ShaderMaterial, color: number): void {
	(material.uniforms.uColor.value as Color).setHex(color);
}
