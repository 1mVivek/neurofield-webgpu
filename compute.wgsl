// ======================================
// PARTICLE STRUCT (MATCHES JS STRIDE)
// ======================================
struct Particle {
  pos : vec2<f32>,   // x, y
  vel : vec2<f32>,   // vx, vy
  energy : f32,      // activity level
  _pad : f32,        // padding (IMPORTANT)
};

// ======================================
// BUFFERS
// ======================================
@group(0) @binding(0)
var<storage, read_write> particles : array<Particle>;

// vec4<f32> REQUIRED for uniform alignment
// x,y = mouse position
// z   = sound level
// w   = padding (unused)
@group(0) @binding(1)
var<uniform> inputData : vec4<f32>;

// ======================================
// COMPUTE SHADER
// ======================================
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
  let i = id.x;

  // Safety check
  if (i >= arrayLength(&particles)) {
    return;
  }

  var p = particles[i];

  // --------------------------------------
  // INPUT
  // --------------------------------------
  let mouse = inputData.xy;
  let sound = clamp(inputData.z, 0.0, 1.0);

  // --------------------------------------
  // DIRECTION & DISTANCE
  // --------------------------------------
  let dir = mouse - p.pos;
  let dist = length(dir) + 0.001;
  let normDir = dir / dist;

  // --------------------------------------
  // NEURAL FIELD EXCITATION
  // --------------------------------------
  let radius = 0.5;
  let influence = clamp(1.0 - dist / radius, 0.0, 1.0);

  // excitation + sound boost
  let excitation = influence * influence;
  p.energy += excitation * 0.015;
  p.energy += sound * 0.03;

  // decay (prevents explosion)
  p.energy *= 0.985;
  p.energy = clamp(p.energy, 0.05, 1.0);

  // --------------------------------------
  // MOTION FORCES
  // --------------------------------------
  let attraction = normDir * p.energy * 0.002;
  let swirl = vec2(-normDir.y, normDir.x) * p.energy * 0.001;

  p.vel += attraction + swirl;
  p.vel *= 0.96;

  // --------------------------------------
  // UPDATE POSITION
  // --------------------------------------
  p.pos += p.vel;

  // Soft boundary wrap (keeps particles alive)
  if (p.pos.x > 1.2) { p.pos.x = -1.2; }
  if (p.pos.x < -1.2) { p.pos.x = 1.2; }
  if (p.pos.y > 1.2) { p.pos.y = -1.2; }
  if (p.pos.y < -1.2) { p.pos.y = 1.2; }

  // --------------------------------------
  // WRITE BACK
  // --------------------------------------
  particles[i] = p;
}
