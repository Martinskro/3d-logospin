export interface ProcessedImage {
  url: string;
  width: number;
  height: number;
  data: ImageData;
}

export async function processImage(file: File): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
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
        
        // Process the image (remove background, enhance edges, etc.)
        const processedData = enhanceImage(imageData);

        // Put processed data back on canvas
        ctx.putImageData(processedData, 0, 0);

        // Convert to data URL
        const processedUrl = canvas.toDataURL('image/png');

        resolve({
          url: processedUrl,
          width: canvas.width,
          height: canvas.height,
          data: processedData
        });
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

function enhanceImage(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const enhancedData = new Uint8ClampedArray(data.length);

  // Copy original data
  for (let i = 0; i < data.length; i++) {
    enhancedData[i] = data[i];
  }

  // Apply edge detection and enhancement
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // Get neighboring pixels
      const left = (y * width + (x - 1)) * 4;
      const right = (y * width + (x + 1)) * 4;
      const top = ((y - 1) * width + x) * 4;
      const bottom = ((y + 1) * width + x) * 4;

      // Calculate edge strength
      const edgeStrength = calculateEdgeStrength(
        data, enhancedData, idx, left, right, top, bottom
      );

      // Enhance edges
      if (edgeStrength > 30) {
        enhancedData[idx] = 0;     // R
        enhancedData[idx + 1] = 0; // G
        enhancedData[idx + 2] = 0; // B
        enhancedData[idx + 3] = 255; // A
      }
    }
  }

  return new ImageData(enhancedData, width, height);
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