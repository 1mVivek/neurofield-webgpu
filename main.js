const canvas = document.getElementById("c");
canvas.width = innerWidth;
canvas.height = innerHeight;

const greeting = document.getElementById("greeting");
const modal = document.getElementById("modal");
const startBtn = document.getElementById("startBtn");

let userName = "";

// ---------- NAME FLOW ----------
startBtn.onclick = () => {
  userName = document.getElementById("nameInput").value || "Explorer";
  greeting.textContent = `Welcome, ${userName}`;
  modal.style.display = "none";
  initAudio();
};

// ---------- AUDIO ----------
let soundLevel = 0;

async function initAudio() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;

  const source = ctx.createMediaStreamSource(stream);
  source.connect(analyser);

  const data = new Uint8Array(analyser.frequencyBinCount);

  function updateAudio() {
    analyser.getByteFrequencyData(data);
    const avg = data.reduce((a,b)=>a+b,0) / data.length;
    soundLevel = avg / 255;
    requestAnimationFrame(updateAudio);
  }
  updateAudio();
}

// ---------- WEBGPU ----------
if (!navigator.gpu) alert("WebGPU not supported");

const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const context = canvas.getContext("webgpu");
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format });

const PARTICLES = 4096;
const data = new Float32Array(PARTICLES * 5);

for (let i = 0; i < PARTICLES; i++) {
  data[i*5] = Math.random()*2-1;
  data[i*5+1] = Math.random()*2-1;
  data[i*5+4] = Math.random();
}

const particleBuffer = device.createBuffer({
  size: data.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  mappedAtCreation: true
});
new Float32Array(particleBuffer.getMappedRange()).set(data);
particleBuffer.unmap();

const inputBuffer = device.createBuffer({
  size: 12,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
});

let mouse = [0,0];
addEventListener("mousemove", e=>{
  mouse[0]=(e.clientX/innerWidth)*2-1;
  mouse[1]=-(e.clientY/innerHeight)*2+1;
});

const compute = device.createShaderModule({
  code: await fetch("compute.wgsl").then(r=>r.text())
});
const render = device.createShaderModule({
  code: await fetch("render.wgsl").then(r=>r.text())
});

const computePipeline = device.createComputePipeline({
  layout:"auto",
  compute:{module:compute,entryPoint:"main"}
});

const bindGroup = device.createBindGroup({
  layout: computePipeline.getBindGroupLayout(0),
  entries:[
    {binding:0,resource:{buffer:particleBuffer}},
    {binding:1,resource:{buffer:inputBuffer}}
  ]
});

const renderPipeline = device.createRenderPipeline({
  layout:"auto",
  vertex:{
    module:render,
    entryPoint:"vs",
    buffers:[{
      arrayStride:20,
      attributes:[
        {shaderLocation:0,offset:0,format:"float32x2"},
        {shaderLocation:1,offset:16,format:"float32"}
      ]
    }]
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
