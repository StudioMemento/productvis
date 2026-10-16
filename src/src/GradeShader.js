// A single lightweight colour pass. Alpha is preserved for transparent PNG output.
export const GradeShader = {
  uniforms: { tDiffuse:{value:null}, contrast:{value:1}, saturation:{value:1}, vignette:{value:0} },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float contrast,saturation,vignette; varying vec2 vUv;
    void main(){
      vec4 source=texture2D(tDiffuse,vUv);
      float luminance=dot(source.rgb,vec3(.2126,.7152,.0722));
      vec3 color=mix(vec3(luminance),source.rgb,saturation);
      color=(color-.18)*contrast+.18;
      float edge=smoothstep(.22,.72,distance(vUv,vec2(.5)));
      color*=1.0-vignette*edge;
      gl_FragColor=vec4(max(color,vec3(0.0)),source.a);
    }`,
};
