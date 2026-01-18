struct Particle {
  pos : vec2<f32>,
  vel : vec2<f32>,
  energy : f32,
};

@group(0) @binding(0)
var<storage, read_write> particles : array<Particle>;

@group(0) @binding(1)
var<uniform> mouse : vec2<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
  let i = id.x;
  if (i >= arrayLength(&particles)) {
    return;
  }

  var p = particles[i];

  let dir = mouse - p.pos;
  let dist = length(dir) + 0.001;

  // 🧠 Neural-field-like rule
  let excitation = exp(-dist * 3.0);

  p.energy += excitation * 0.01;
  p.energy *= 0.995;

  let force = normalize(dir) * p.energy * 0.002;
  p.vel += force;
  p.vel *= 0.98;
  p.pos += p.vel;

  particles[i] = p;
}
