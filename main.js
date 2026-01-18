// =======================
// CANVAS SETUP
// =======================
const canvas = document.getElementById("c");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// =======================
// UI ELEMENTS
// =======================
const greeting = document.getElementById("greeting");
const modal = document.getElementById("modal");
const startBtn = document.getElementById("startBtn");
const nameInput = document.getElementById("nameInput");

// =======================
// STATE
// =======================
let soundLevel = 0;
let userName = "Explorer";

// =======================
// NAME + AUDIO START
// =======================
startBtn.addEventListener("click", async () => {
  userName = nameInput.value.trim() || "Explorer";
  greeting.textContent = `Welcome, ${userName}`;
  modal.style.display = "none";
  await initAudio(); // must be user-triggered
});

// =======================
// AUDIO (SAFE VERSION)
// =======================
async function initAudio() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const audioCtx = new AudioContext();
    await audioCtx.resume(); // REQUIRED

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);

    function updateAudio() {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      soundLevel = (sum / data.length) / 255;
      requestAnimationFrame(updateAudio);
    }

    updateAudio();
  } catch (err) {
    console.warn("Microphone access denied. Audio disabled.");
    soundLevel = 0;
  }
}

// =======================
// WEBGPU SETUP
// =======================
if (!navigator.gpu) {
  alert("WebGPU not supported in this browser");
  throw new Error("WebGPU not supported");
}

const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

const context = canvas.getContext("webgpu");
const format = navigator.gpu.getPreferredCanvasFormat();

context.configure({
  device,
  format,
  alphaMode: "opaque",
});

// =======================
// PARTICLES
// =======================
const PARTICLES = 4096;
const particleStride = 5; // x,y,vx,vy,energy

const particleData = new Float32Array(PARTICLES * particleStride);

for (let i = 0; i < PARTICLES; i++) {
  particleData[i * 5 + 0] = Math.random() * 2 - 1;
  particleData[i * 5 + 1] = Math.random() * 2 - 1;
  particleData[i * 5 + 2] = 0;
  particleData[i * 5 + 3] = 0;
  particleData[i * 5 + 4] = Math.random();
}

const particleBuffer = device.createBuffer({
  size: particleData.byteLength,
  usage:
    GPUBufferUsage.STORAGE |
    GPUBufferUsage.VERTEX |
    GPUBufferUsage.COPY_DST,
  mappedAtCreation: true,
});

new Float32Array(particleBuffer.getMappedRange()).set(particleData);
particleBuffer.unmap();

// =======================
// INPUT UNIFORM BUFFER (vec4<f32> = 16 bytes)
// =======================
const inputBuffer = device.createBuffer({
  size: 16,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

// =======================
// MOUSE INPUT
// =======================
let mouseX = 0;
let mouseY = 0;

window.addEventListener("mousemove", (e) => {
  mouseX = (e.clientX / window.innerWidth) * 2 - 1;
  mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
});

// =======================
// LOAD SHADERS
// =======================
const computeCode = await fetch("compute.wgsl").then((r) => r.text());
const renderCode = await fetch("render.wgsl").then((r) => r.text());

const computeModule = device.createShaderModule({ code: computeCode });
const renderModule = device.createShaderModule({ code: renderCode });

// =======================
// COMPUTE PIPELINE
// =======================
const computePipeline = device.createComputePipeline({
  layout: "auto",
  compute: {
    module: computeModule,
    entryPoint: "main",
  },
});

const bindGroup = device.createBindGroup({
  layout: computePipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: particleBuffer } },
    { binding: 1, resource: { buffer: inputBuffer } },
  ],
});

// =======================
// RENDER PIPELINE
// =======================
const renderPipeline = device.createRenderPipeline({
  layout: "auto",
  vertex: {
    module: renderModule,
    entryPoint: "vs",
    buffers: [
      {
        arrayStride: 20,
        attributes: [
          { shaderLocation: 0, offset: 0, format: "float32x2" },
          { shaderLocation: 1, offset: 16, format: "float32" },
        ],
      },
    ],
  },
  fragment: {
    module: renderModule,
    entryPoint: "fs",
    targets: [{ format }],
  },
  primitive: {
    topology: "point-list",
  },
});

// =======================
// MAIN LOOP
// =======================
function frame() {
  // write mouse + sound to uniform buffer
  device.queue.writeBuffer(
    inputBuffer,
    0,
    new Float32Array([mouseX, mouseY, soundLevel, 0])
  );

  const encoder = device.createCommandEncoder();

  // COMPUTE PASS
  const computePass = encoder.beginComputePass();
  computePass.setPipeline(computePipeline);
  computePass.setBindGroup(0, bindGroup);
  computePass.dispatchWorkgroups(Math.ceil(PARTICLES / 64));
  computePass.end();

  // RENDER PASS
  const renderPass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        loadOp: "clear",
        storeOp: "store",
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
      },
    ],
  });

  renderPass.setPipeline(renderPipeline);
  renderPass.setVertexBuffer(0, particleBuffer);
  renderPass.draw(PARTICLES);
  renderPass.end();

  device.queue.submit([encoder.finish()]);
  requestAnimationFrame(frame);
}

frame();    }]
  },
  fragment:{
    module:render,
    entryPoint:"fs",
    targets:[{format}]
  },
  primitive:{topology:"point-list"}
});

function frame(){
  device.queue.writeBuffer(
    inputBuffer,
    0,
    new Float32Array([mouse[0], mouse[1], soundLevel])
  );

  const encoder=device.createCommandEncoder();

  const cp=encoder.beginComputePass();
  cp.setPipeline(computePipeline);
  cp.setBindGroup(0,bindGroup);
  cp.dispatchWorkgroups(Math.ceil(PARTICLES/64));
  cp.end();

  const rp=encoder.beginRenderPass({
    colorAttachments:[{
      view:context.getCurrentTexture().createView(),
      loadOp:"clear",
      storeOp:"store",
      clearValue:{r:0,g:0,b:0,a:1}
    }]
  });
  rp.setPipeline(renderPipeline);
  rp.setVertexBuffer(0,particleBuffer);
  rp.draw(PARTICLES);
  rp.end();

  device.queue.submit([encoder.finish()]);
  requestAnimationFrame(frame);
}
frame();
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
