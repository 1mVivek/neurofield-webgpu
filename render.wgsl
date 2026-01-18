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
  out.pos = vec4(pos, 0.0, 1.0);
  out.energy = energy;
  return out;
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4<f32> {
  return vec4(0.0, 1.0, 1.0, in.energy);
}
