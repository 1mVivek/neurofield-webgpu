struct Particle {
  pos : vec2<f32>,
  vel : vec2<f32>,
  energy : f32,
};

@group(0) @binding(0)
var<storage, read_write> particles : array<Particle>;

@group(0) @binding(1)
var<uniform> inputData : vec3<f32>; 
// x,y = mouse | z = sound energy

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
  let i = id.x;
  if (i >= arrayLength(&particles)) {
    return;
  }

  var p = particles[i];

  let dir = inputData.xy - p.pos;
  let dist = length(dir) + 0.001;

  // Neural field excitation
  let excitation = exp(-dist * 4.0);

  // Sound boosts energy
  p.energy += excitation * 0.01;
  p.energy += inputData.z * 0.02;

  p.energy *= 0.99;

  let force = normalize(dir) * p.energy * 0.002;
  p.vel += force;

  // subtle swirl
  p.vel += vec2(-dir.y, dir.x) * 0.0004 * p.energy;

  p.vel *= 0.97;
  p.pos += p.vel;

  particles[i] = p;
}
