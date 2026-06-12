const categories = {
  tops: { label: "上衣", defaults: { x: 0, y: -18, scale: 100, rotate: 0 } },
  bottoms: { label: "下装", defaults: { x: 0, y: 18, scale: 100, rotate: 0 } },
  shoes: { label: "鞋履", defaults: { x: 0, y: 38, scale: 100, rotate: 0 } },
  bags: { label: "包饰", defaults: { x: 26, y: 0, scale: 100, rotate: 0 } },
};

const storageKey = "outfit-studio-items-v1";
const state = {
  activeCategory: "tops",
  activeLayer: "tops",
  items: loadItems(),
  look: Object.fromEntries(
    Object.keys(categories).map((key) => [key, { itemId: null, ...categories[key].defaults }])
  ),
};

const fileInput = document.querySelector("#fileInput");
const categorySelect = document.querySelector("#categorySelect");
const removeBgToggle = document.querySelector("#removeBgToggle");
const bgToleranceRange = document.querySelector("#bgToleranceRange");
const dropZone = document.querySelector("#dropZone");
const uploadStatus = document.querySelector("#uploadStatus");
const closetGrid = document.querySelector("#closetGrid");
const itemTemplate = document.querySelector("#closetItemTemplate");
const lookCanvas = document.querySelector("#lookCanvas");
const selectedLayerName = document.querySelector("#selectedLayerName");
const scaleRange = document.querySelector("#scaleRange");
const xRange = document.querySelector("#xRange");
const yRange = document.querySelector("#yRange");
const rotateRange = document.querySelector("#rotateRange");

renderCloset();
renderLook();
syncControls();

document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.activeCategory = button.dataset.category;
    categorySelect.value = state.activeCategory;
    document.querySelectorAll(".tab-button").forEach((tab) => tab.classList.toggle("active", tab === button));
    renderCloset();
  });
});

document.querySelectorAll(".tool-button").forEach((button) => {
  button.addEventListener("click", () => setActiveLayer(button.dataset.layer));
});

document.querySelectorAll(".swatch").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".swatch").forEach((swatch) => swatch.classList.toggle("active", swatch === button));
    lookCanvas.style.backgroundColor = button.dataset.bg;
  });
});

fileInput.addEventListener("change", (event) => {
  addFiles(event.target.files);
  fileInput.value = "";
});

categorySelect.addEventListener("change", () => {
  state.activeCategory = categorySelect.value;
  document.querySelectorAll(".tab-button").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.category === state.activeCategory);
  });
  renderCloset();
});

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});

["dragenter", "dragover"].forEach((type) => {
  dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach((type) => {
  dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
});

dropZone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));

[scaleRange, xRange, yRange, rotateRange].forEach((range) => {
  range.addEventListener("input", () => {
    const layer = state.look[state.activeLayer];
    layer.scale = Number(scaleRange.value);
    layer.x = Number(xRange.value);
    layer.y = Number(yRange.value);
    layer.rotate = Number(rotateRange.value);
    renderLook();
  });
});

document.querySelector("#resetLayer").addEventListener("click", () => {
  const currentItem = state.look[state.activeLayer].itemId;
  state.look[state.activeLayer] = { itemId: currentItem, ...categories[state.activeLayer].defaults };
  syncControls();
  renderLook();
});

document.querySelector("#clearCanvas").addEventListener("click", () => {
  Object.keys(categories).forEach((key) => {
    state.look[key] = { itemId: null, ...categories[key].defaults };
  });
  syncControls();
  renderCloset();
  renderLook();
});

document.querySelector("#downloadLook").addEventListener("click", downloadLook);

function addFiles(fileList) {
  const files = [...fileList].filter((file) => file.type.startsWith("image/"));
  files.forEach((file) => {
    const reader = new FileReader();
    reader.addEventListener("load", async () => {
      const category = categorySelect.value;
      const rawSrc = reader.result;
      const shouldRemoveBg = removeBgToggle.checked;
      uploadStatus.textContent = shouldRemoveBg ? "正在扣除背景..." : "正在加入搭配...";

      let src = rawSrc;
      if (shouldRemoveBg) {
        try {
          src = await removeImageBackground(rawSrc, Number(bgToleranceRange.value));
        } catch {
          src = rawSrc;
          uploadStatus.textContent = "扣背景失败，已使用原图";
        }
      }

      const item = {
        id: createId(),
        category,
        name: cleanName(file.name),
        src,
        backgroundRemoved: shouldRemoveBg && src !== rawSrc,
      };

      state.items.unshift(item);
      state.look[category].itemId = item.id;
      setActiveLayer(category);
      uploadStatus.textContent = item.backgroundRemoved
        ? `已扣背景并加入${categories[category].label}搭配`
        : `已加入${categories[category].label}搭配`;
      saveItems();
      renderCloset();
      renderLook();
    });
    reader.readAsDataURL(file);
  });
}

function renderCloset() {
  closetGrid.replaceChildren();
  const items = state.items.filter((item) => item.category === state.activeCategory);

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = `${categories[state.activeCategory].label}还没有图片`;
    closetGrid.append(empty);
    return;
  }

  items.forEach((item) => {
    const node = itemTemplate.content.firstElementChild.cloneNode(true);
    const imageButton = node.querySelector(".item-image");
    const name = node.querySelector(".item-name");
    const remove = node.querySelector(".remove-item");
    const isSelected = state.look[item.category].itemId === item.id;

    node.classList.toggle("selected", isSelected);
    imageButton.style.backgroundImage = `url("${item.src}")`;
    imageButton.setAttribute("aria-label", `选择 ${item.name}`);
    name.textContent = item.name;

    imageButton.addEventListener("click", () => {
      state.look[item.category].itemId = item.id;
      setActiveLayer(item.category);
      renderCloset();
      renderLook();
    });

    remove.addEventListener("click", () => {
      state.items = state.items.filter((candidate) => candidate.id !== item.id);
      Object.values(state.look).forEach((layer) => {
        if (layer.itemId === item.id) layer.itemId = null;
      });
      saveItems();
      renderCloset();
      renderLook();
    });

    closetGrid.append(node);
  });
}

function renderLook() {
  lookCanvas.querySelectorAll(".look-layer").forEach((layer) => layer.remove());

  Object.keys(categories).forEach((key) => {
    const layer = state.look[key];
    const item = state.items.find((candidate) => candidate.id === layer.itemId);
    if (!item) return;

    const element = document.createElement("div");
    const image = document.createElement("img");
    element.className = "look-layer";
    element.dataset.layer = key;
    applyLayerStyle(element, layer);
    element.style.zIndex = layerZIndex(key);
    element.classList.toggle("active", key === state.activeLayer);
    image.src = item.src;
    image.alt = item.name;
    element.append(image);
    element.addEventListener("pointerdown", (event) => startDrag(event, key, element));
    element.addEventListener("click", () => setActiveLayer(key));
    lookCanvas.append(element);
  });
}

function setActiveLayer(layer, shouldRender = true) {
  state.activeLayer = layer;
  selectedLayerName.textContent = categories[layer].label;
  document.querySelectorAll(".tool-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.layer === layer);
  });
  syncControls();
  if (shouldRender) renderLook();
}

function syncControls() {
  const layer = state.look[state.activeLayer];
  selectedLayerName.textContent = categories[state.activeLayer].label;
  scaleRange.value = layer.scale;
  xRange.value = layer.x;
  yRange.value = layer.y;
  rotateRange.value = layer.rotate;
}

function startDrag(event, key, element) {
  event.preventDefault();
  setActiveLayer(key, false);
  lookCanvas.querySelectorAll(".look-layer").forEach((layer) => layer.classList.toggle("active", layer === element));
  element.classList.add("dragging");
  element.setPointerCapture(event.pointerId);

  const pointers = new Map([[event.pointerId, { x: event.clientX, y: event.clientY }]]);
  let start = getGestureState(pointers, state.look[key]);
  const rect = lookCanvas.getBoundingClientRect();

  function move(moveEvent) {
    if (!pointers.has(moveEvent.pointerId)) return;
    pointers.set(moveEvent.pointerId, { x: moveEvent.clientX, y: moveEvent.clientY });
    updateLayerFromGesture(key, element, pointers, start, rect);
  }

  function addPointer(pointerEvent) {
    pointers.set(pointerEvent.pointerId, { x: pointerEvent.clientX, y: pointerEvent.clientY });
    element.setPointerCapture(pointerEvent.pointerId);
    start = getGestureState(pointers, state.look[key]);
  }

  function removePointer(pointerEvent) {
    pointers.delete(pointerEvent.pointerId);
    if (pointers.size) {
      start = getGestureState(pointers, state.look[key]);
      return;
    }
    element.classList.remove("dragging");
    element.removeEventListener("pointermove", move);
    element.removeEventListener("pointerdown", addPointer);
    element.removeEventListener("pointerup", removePointer);
    element.removeEventListener("pointercancel", removePointer);
    element.removeEventListener("lostpointercapture", removePointer);
  }

  element.addEventListener("pointermove", move);
  element.addEventListener("pointerdown", addPointer);
  element.addEventListener("pointerup", removePointer);
  element.addEventListener("pointercancel", removePointer);
  element.addEventListener("lostpointercapture", removePointer);
}

function applyLayerStyle(element, layer) {
  element.style.left = `${50 + layer.x}%`;
  element.style.top = `${50 + layer.y}%`;
  element.style.transform = `translate(-50%, -50%) scale(${layer.scale / 100}) rotate(${layer.rotate}deg)`;
}

function getGestureState(pointers, layer) {
  const points = [...pointers.values()];
  const center = getCenter(points);
  return {
    center,
    distance: points.length > 1 ? getDistance(points[0], points[1]) : 0,
    angle: points.length > 1 ? getAngle(points[0], points[1]) : 0,
    x: layer.x,
    y: layer.y,
    scale: layer.scale,
    rotate: layer.rotate,
  };
}

function updateLayerFromGesture(key, element, pointers, start, rect) {
  const points = [...pointers.values()];
  const center = getCenter(points);
  const layer = state.look[key];
  const dx = ((center.x - start.center.x) / rect.width) * 100;
  const dy = ((center.y - start.center.y) / rect.height) * 100;

  layer.x = clamp(start.x + dx, -48, 48);
  layer.y = clamp(start.y + dy, -48, 48);

  if (points.length > 1 && start.distance > 0) {
    const distance = getDistance(points[0], points[1]);
    const angle = getAngle(points[0], points[1]);
    layer.scale = clamp(Math.round(start.scale * (distance / start.distance)), 35, 180);
    layer.rotate = clamp(Math.round(start.rotate + angle - start.angle), -25, 25);
  }

  applyLayerStyle(element, layer);
  syncControls();
}

function getCenter(points) {
  const total = points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 }
  );
  return { x: total.x / points.length, y: total.y / points.length };
}

function getDistance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function getAngle(first, second) {
  return (Math.atan2(second.y - first.y, second.x - first.x) * 180) / Math.PI;
}

async function downloadLook() {
  const canvas = document.createElement("canvas");
  const width = 1200;
  const height = 1600;
  const context = canvas.getContext("2d");
  canvas.width = width;
  canvas.height = height;

  context.fillStyle = getComputedStyle(lookCanvas).backgroundColor;
  context.fillRect(0, 0, width, height);
  drawGuide(context, width, height);

  for (const key of Object.keys(categories)) {
    const layer = state.look[key];
    const item = state.items.find((candidate) => candidate.id === layer.itemId);
    if (!item) continue;
    const image = await loadImage(item.src);
    const baseWidth = width * layerBaseWidth(key);
    const scaledWidth = baseWidth * (layer.scale / 100);
    const scaledHeight = scaledWidth * (image.naturalHeight / image.naturalWidth);
    const x = width / 2 + (layer.x / 100) * width;
    const y = height / 2 + (layer.y / 100) * height;

    context.save();
    context.translate(x, y);
    context.rotate((layer.rotate * Math.PI) / 180);
    context.drawImage(image, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
    context.restore();
  }

  const link = document.createElement("a");
  link.download = `outfit-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function drawGuide(context, width, height) {
  context.save();
  context.strokeStyle = "rgba(143, 157, 151, 0.38)";
  context.lineWidth = 5;
  context.beginPath();
  context.arc(width / 2, height * 0.13, width * 0.055, 0, Math.PI * 2);
  context.stroke();
  context.strokeRect(width * 0.39, height * 0.26, width * 0.22, height * 0.25);
  context.beginPath();
  context.moveTo(width * 0.42, height * 0.52);
  context.lineTo(width * 0.37, height * 0.88);
  context.moveTo(width * 0.58, height * 0.52);
  context.lineTo(width * 0.63, height * 0.88);
  context.stroke();
  context.restore();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function removeImageBackground(src, tolerance) {
  const image = await loadImage(src);
  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  const visited = new Uint8Array(width * height);
  const queue = [];
  const edgePalette = collectEdgePalette(data, width, height);
  const limit = tolerance * tolerance;
  const softLimit = (tolerance + 20) * (tolerance + 20);

  function enqueue(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
    if (visited[index]) return;
    const offset = index * 4;
    if (nearestPaletteDistance(data[offset], data[offset + 1], data[offset + 2], edgePalette) > softLimit) return;
    visited[index] = 1;
    queue.push(index);
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  for (let pointer = 0; pointer < queue.length; pointer += 1) {
    const index = queue[pointer];
    const x = index % width;
    const y = Math.floor(index / width);
    const offset = index * 4;
    const distance = nearestPaletteDistance(data[offset], data[offset + 1], data[offset + 2], edgePalette);
    const alpha = distance <= limit ? 0 : Math.round(((distance - limit) / (softLimit - limit)) * 255);
    data[offset + 3] = Math.min(data[offset + 3], alpha);
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  featherAlpha(data, width, height);
  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function collectEdgePalette(data, width, height) {
  const samples = [];
  const step = Math.max(1, Math.floor(Math.min(width, height) / 28));

  function push(x, y) {
    const offset = (y * width + x) * 4;
    samples.push([data[offset], data[offset + 1], data[offset + 2]]);
  }

  for (let x = 0; x < width; x += step) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += step) {
    push(0, y);
    push(width - 1, y);
  }
  push(0, 0);
  push(width - 1, 0);
  push(0, height - 1);
  push(width - 1, height - 1);
  return samples;
}

function nearestPaletteDistance(red, green, blue, palette) {
  let nearest = Infinity;
  for (const color of palette) {
    const dr = red - color[0];
    const dg = green - color[1];
    const db = blue - color[2];
    const distance = dr * dr + dg * dg + db * db;
    if (distance < nearest) nearest = distance;
  }
  return nearest;
}

function featherAlpha(data, width, height) {
  const originalAlpha = new Uint8Array(width * height);
  for (let index = 0; index < originalAlpha.length; index += 1) {
    originalAlpha[index] = data[index * 4 + 3];
  }

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (originalAlpha[index] === 0) continue;
      const neighborMin = Math.min(
        originalAlpha[index - 1],
        originalAlpha[index + 1],
        originalAlpha[index - width],
        originalAlpha[index + width]
      );
      if (neighborMin < 255) {
        data[index * 4 + 3] = Math.min(originalAlpha[index], Math.max(80, neighborMin + 90));
      }
    }
  }
}

function loadItems() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function saveItems() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state.items.slice(0, 80)));
  } catch {
    localStorage.removeItem(storageKey);
  }
}

function cleanName(name) {
  return name.replace(/\.[^.]+$/, "").slice(0, 28) || "衣物";
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function layerZIndex(layer) {
  return { bottoms: 2, tops: 3, shoes: 4, bags: 5 }[layer];
}

function layerBaseWidth(layer) {
  return { tops: 0.54, bottoms: 0.48, shoes: 0.42, bags: 0.34 }[layer];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
