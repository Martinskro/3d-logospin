export interface ProcessedImage {
  url: string;
  width: number;
  height: number;
  data: ImageData;
  mask: ImageData;
  isPNG: boolean;
}

export async function processImage(file: File): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      reject(new Error('Invalid file type. Please select an image file.'));
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      reject(new Error('File size must be less than 10MB.'));
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Validate image dimensions
        if (img.width > 4096 || img.height > 4096) {
          reject(new Error('Image dimensions must be less than 4096x4096 pixels.'));
          return;
        }

        // Create canvas for image processing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Set canvas size to match image
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw image to canvas
        ctx.drawImage(img, 0, 0);

        // Get image data for processing
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Process the image and create mask
        const { processedData, maskData } = processImageAndCreateMask(imageData, file.type === 'image/png');

        // Put processed data back on canvas
        ctx.putImageData(processedData, 0, 0);

        // Convert to data URL with proper MIME type
        const processedUrl = canvas.toDataURL('image/png');

        resolve({
          url: processedUrl,
          width: canvas.width,
          height: canvas.height,
          data: processedData,
          mask: maskData,
          isPNG: file.type === 'image/png'
        });
      };

      img.onerror = () => {
        reject(new Error('Failed to load image. Please try another file.'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file. Please try again.'));
    };

    reader.readAsDataURL(file);
  });
}

function processImageAndCreateMask(imageData: ImageData, isPNG: boolean): { processedData: ImageData; maskData: ImageData } {
  const { data, width, height } = imageData;
  const processedData = new Uint8ClampedArray(data.length);
  const maskData = new Uint8ClampedArray(data.length);

  // Copy original data
  for (let i = 0; i < data.length; i++) {
    processedData[i] = data[i];
    maskData[i] = data[i];
  }

  // Process the image and create mask
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // Get neighboring pixels
      const left = (y * width + (x - 1)) * 4;
      const right = (y * width + (x + 1)) * 4;
      const top = ((y - 1) * width + x) * 4;
      const bottom = ((y + 1) * width + x) * 4;

      // Calculate edge strength and alpha
      const edgeStrength = calculateEdgeStrength(
        data, processedData, idx, left, right, top, bottom
      );
      const alpha = data[idx + 3];

      if (isPNG) {
        // For PNGs, use the alpha channel directly
        if (alpha > 0) {
          // Keep original color data
          processedData[idx] = data[idx];     // R
          processedData[idx + 1] = data[idx + 1]; // G
          processedData[idx + 2] = data[idx + 2]; // B
          processedData[idx + 3] = 255; // A
          
          // Set mask to white
          maskData[idx] = 255;     // R
          maskData[idx + 1] = 255; // G
          maskData[idx + 2] = 255; // B
          maskData[idx + 3] = 255; // A
        } else {
          // Set transparent
          processedData[idx + 3] = 0; // A
          maskData[idx + 3] = 0; // A
        }
      } else {
        // For non-PNGs, detect edges and create mask
        const isEdge = edgeStrength > 30;
        const isContent = isEdge || (data[idx] > 0 || data[idx + 1] > 0 || data[idx + 2] > 0);
        
        if (isContent) {
          // Keep original color data
          processedData[idx] = data[idx];     // R
          processedData[idx + 1] = data[idx + 1]; // G
          processedData[idx + 2] = data[idx + 2]; // B
          processedData[idx + 3] = 255; // A
          
          // Set mask to white
          maskData[idx] = 255;     // R
          maskData[idx + 1] = 255; // G
          maskData[idx + 2] = 255; // B
          maskData[idx + 3] = 255; // A
        } else {
          // Set transparent
          processedData[idx + 3] = 0; // A
          maskData[idx + 3] = 0; // A
        }
      }
    }
  }

  return {
    processedData: new ImageData(processedData, width, height),
    maskData: new ImageData(maskData, width, height)
  };
}

function calculateEdgeStrength(
  original: Uint8ClampedArray,
  enhanced: Uint8ClampedArray,
  idx: number,
  left: number,
  right: number,
  top: number,
  bottom: number
): number {
  // Calculate differences between current pixel and neighbors
  const horizontalDiff = Math.abs(original[idx] - original[right]) +
                         Math.abs(original[idx + 1] - original[right + 1]) +
                         Math.abs(original[idx + 2] - original[right + 2]);
  
  const verticalDiff = Math.abs(original[idx] - original[bottom]) +
                       Math.abs(original[idx + 1] - original[bottom + 1]) +
                       Math.abs(original[idx + 2] - original[bottom + 2]);

  // Return the maximum difference as edge strength
  return Math.max(horizontalDiff, verticalDiff);
} 