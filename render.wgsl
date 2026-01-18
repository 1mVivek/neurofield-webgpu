struct VSOut {
  @builtin(position) pos : vec4<f32>,
  @location(0) energy : f32
};

@vertex
fn vs(
  @location(0) pos : vec2<f32>,
  @location(1) energy : f32
) -> VSOut {
  var out : VSOut;
  out.pos = vec4(pos * (0.9 + energy * 0.3), 0.0, 1.0);
  out.energy = energy;
  return out;
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4<f32> {
  let e = clamp(in.energy, 0.0, 1.0);
  let color = vec3(e, 0.4 + e * 0.4, 1.0 - e * 0.6);
  return vec4(color, 1.0);
}
