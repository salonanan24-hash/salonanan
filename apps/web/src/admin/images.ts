export function readCoverImage(file: File, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const source = String(reader.result ?? '');
      const image = new Image();
      image.onerror = () => reject(new Error('image'));
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(source);
          return;
        }
        const scale = Math.max(width / image.width, height / image.height);
        const cropWidth = width / scale;
        const cropHeight = height / scale;
        context.drawImage(
          image,
          (image.width - cropWidth) / 2,
          (image.height - cropHeight) / 2,
          cropWidth,
          cropHeight,
          0,
          0,
          width,
          height,
        );
        resolve(encodeCanvas(canvas, context));
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
  });
}

export function readSquareImage(file: File, edge = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const source = String(reader.result ?? '');
      const image = new Image();
      image.onerror = () => reject(new Error('image'));
      image.onload = () => {
        const side = Math.min(image.width, image.height);
        const canvas = document.createElement('canvas');
        canvas.width = edge;
        canvas.height = edge;
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(source);
          return;
        }
        context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, edge, edge);
        resolve(encodeCanvas(canvas, context));
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
  });
}

export function readResizedImages(files: FileList | File[], maxEdge = 720): Promise<string[]> {
  return Promise.all([...files].slice(0, 6).map((file) => resizeImage(file, maxEdge)));
}

function resizeImage(file: File, maxEdge: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const source = String(reader.result ?? '');
      const image = new Image();
      image.onerror = () => reject(new Error('image'));
      image.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(source);
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(encodeCanvas(canvas, context));
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
  });
}

function encodeCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): string {
  if (!hasTransparency(context, canvas.width, canvas.height)) {
    return canvas.toDataURL('image/jpeg', 0.72);
  }

  const webp = canvas.toDataURL('image/webp', 0.92);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
}

function hasTransparency(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  const { data } = context.getImageData(0, 0, width, height);
  for (let index = 3; index < data.length; index += 4) {
    const alpha = data[index];
    if (alpha !== undefined && alpha < 255) return true;
  }
  return false;
}
