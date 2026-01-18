const canvas = document.getElementById("c");
canvas.width = innerWidth;
canvas.height = innerHeight;

if (!navigator.gpu) {
  alert("WebGPU not supported");
  throw new Error();
}

const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const context = canvas.getContext("webgpu");
const format = navigator.gpu.getPreferredCanvasFormat();

context.configure({ device, format });

const PARTICLES = 4096;

// ------------------
// PARTICLE BUFFER
// ------------------
const particleData = new Float32Array(PARTICLES * 5);
for (let i = 0; i < PARTICLES; i++) {
  particleData[i * 5 + 0] = Math.random() * 2 - 1;
  particleData[i * 5 + 1] = Math.random() * 2 - 1;
  particleData[i * 5 + 2] = 0;
  particleData[i * 5 + 3] = 0;
  particleData[i * 5 + 4] = Math.random();
}

const particleBuffer = device.createBuffer({
  size: particleData.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  mappedAtCreation: true
});

new Float32Array(particleBuffer.getMappedRange()).set(particleData);
particleBuffer.unmap();

// ------------------
// MOUSE BUFFER
// ------------------
const mouseBuffer = device.createBuffer({
  size: 8,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
});

let mouse = [0, 0];
window.addEventListener("mousemove", e => {
  mouse[0] = (e.clientX / innerWidth) * 2 - 1;
  mouse[1] = -(e.clientY / innerHeight) * 2 + 1;
});

// ------------------
// SHADERS
// ------------------
const computeModule = device.createShaderModule({
  code: await fetch("compute.wgsl").then(r => r.text())
});

const renderModule = device.createShaderModule({
  code: await fetch("render.wgsl").then(r => r.text())
});

// ------------------
// COMPUTE PIPELINE
// ------------------
const computePipeline = device.createComputePipeline({
  layout: "auto",
  compute: { module: computeModule, entryPoint: "main" }
});

const computeBindGroup = device.createBindGroup({
  layout: computePipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: particleBuffer } },
    { binding: 1, resource: { buffer: mouseBuffer } }
  ]
});

// ------------------
// RENDER PIPELINE
// ------------------
const renderPipeline = device.createRenderPipeline({
  layout: "auto",
  vertex: {
    module: renderModule,
    entryPoint: "vs",
    buffers: [{
      arrayStride: 20,
      attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x2" },
        { shaderLocation: 1, offset: 16, format: "float32" }
      ]
    }]
  },
  fragment: {
    module: renderModule,
    entryPoint: "fs",
    targets: [{ format }]
  },
  primitive: { topology: "point-list" }
});

// ------------------
// LOOP
// ------------------
function frame() {
  device.queue.writeBuffer(mouseBuffer, 0, new Float32Array(mouse));

  const encoder = device.createCommandEncoder();

  const computePass = encoder.beginComputePass();
  computePass.setPipeline(computePipeline);
  computePass.setBindGroup(0, computeBindGroup);
  computePass.dispatchWorkgroups(Math.ceil(PARTICLES / 64));
  computePass.end();

  const renderPass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      loadOp: "clear",
      storeOp: "store",
      clearValue: { r: 0, g: 0, b: 0, a: 1 }
    }]
  });

  renderPass.setPipeline(renderPipeline);
  renderPass.setVertexBuffer(0, particleBuffer);
  renderPass.draw(PARTICLES);
  renderPass.end();

  device.queue.submit([encoder.finish()]);
  requestAnimationFrame(frame);
}

frame();
