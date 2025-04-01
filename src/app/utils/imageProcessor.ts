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
    // Validate file type - only accept PNG
    if (file.type !== 'image/png') {
      reject(new Error('Only PNG files are supported. Please select a PNG file.'));
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
        const { processedData, maskData } = processImageAndCreateMask(imageData, true); // Always true since we only accept PNGs

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
          isPNG: true // Always true since we only accept PNGs
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

  if (isPNG) {
    // For PNGs, use the alpha channel directly
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha > 0) {
        processedData[i + 3] = 255;
        // Set mask to white for visible pixels
        maskData[i] = 255;
        maskData[i + 1] = 255;
        maskData[i + 2] = 255;
        maskData[i + 3] = 255;
      } else {
        processedData[i + 3] = 0;
        // Set mask to transparent for transparent pixels
        maskData[i] = 0;
        maskData[i + 1] = 0;
        maskData[i + 2] = 0;
        maskData[i + 3] = 0;
      }
    }
  } else {
    // For non-PNGs, use advanced background removal
    const backgroundColor = findDominantBackgroundColor(data, width, height);
    const threshold = calculateColorThreshold(backgroundColor);

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
          data, processedData, idx, left, right, top, bottom
        );

        // Check if pixel is similar to background color
        const isBackground = isSimilarToBackground(
          data[idx], data[idx + 1], data[idx + 2],
          backgroundColor, threshold
        );

        // Determine if pixel should be kept
        const shouldKeep = !isBackground || edgeStrength > 30;

        if (shouldKeep) {
          // Keep original color data
          processedData[idx] = data[idx];
          processedData[idx + 1] = data[idx + 1];
          processedData[idx + 2] = data[idx + 2];
          processedData[idx + 3] = 255;
          
          // Set mask to white for kept pixels
          maskData[idx] = 255;
          maskData[idx + 1] = 255;
          maskData[idx + 2] = 255;
          maskData[idx + 3] = 255;
        } else {
          // Set transparent
          processedData[idx + 3] = 0;
          // Set mask to transparent for removed pixels
          maskData[idx] = 0;
          maskData[idx + 1] = 0;
          maskData[idx + 2] = 0;
          maskData[idx + 3] = 0;
        }
      }
    }
  }

  return {
    processedData: new ImageData(processedData, width, height),
    maskData: new ImageData(maskData, width, height)
  };
}

function findDominantBackgroundColor(data: Uint8ClampedArray, width: number, height: number): [number, number, number] {
  // Sample pixels from the edges of the image
  const samples: [number, number, number][] = [];
  const sampleSize = Math.min(width, height) / 10; // Sample every 10th pixel

  // Sample from edges
  for (let i = 0; i < width; i += sampleSize) {
    // Top edge
    const topIdx = i * 4;
    samples.push([data[topIdx], data[topIdx + 1], data[topIdx + 2]]);
    
    // Bottom edge
    const bottomIdx = ((height - 1) * width + i) * 4;
    samples.push([data[bottomIdx], data[bottomIdx + 1], data[bottomIdx + 2]]);
  }

  for (let i = 0; i < height; i += sampleSize) {
    // Left edge
    const leftIdx = (i * width) * 4;
    samples.push([data[leftIdx], data[leftIdx + 1], data[leftIdx + 2]]);
    
    // Right edge
    const rightIdx = (i * width + (width - 1)) * 4;
    samples.push([data[rightIdx], data[rightIdx + 1], data[rightIdx + 2]]);
  }

  // Find the most common color using k-means clustering
  const k = 3; // Number of clusters
  const clusters = kMeansClustering(samples, k);
  
  // Return the color of the largest cluster
  return clusters.reduce((a, b) => a.length > b.length ? a : b)[0];
}

function kMeansClustering(points: [number, number, number][], k: number): [number, number, number][][] {
  // Initialize centroids randomly
  const centroids = points
    .sort(() => Math.random() - 0.5)
    .slice(0, k);
  
  let clusters: [number, number, number][][] = Array(k).fill([]).map(() => []);
  let oldCentroids: [number, number, number][] = [];
  
  while (true) {
    // Assign points to nearest centroid
    clusters = Array(k).fill([]).map(() => []);
    points.forEach(point => {
      const distances = centroids.map(centroid => 
        distance(point, centroid)
      );
      const nearestCentroidIndex = distances.indexOf(Math.min(...distances));
      clusters[nearestCentroidIndex].push(point);
    });
    
    // Update centroids
    oldCentroids = [...centroids];
    clusters.forEach((cluster, i) => {
      if (cluster.length > 0) {
        centroids[i] = cluster.reduce((sum, point) => [
          sum[0] + point[0],
          sum[1] + point[1],
          sum[2] + point[2]
        ], [0, 0, 0]).map(val => val / cluster.length) as [number, number, number];
      }
    });
    
    // Check convergence
    if (centroids.every((centroid, i) => 
      distance(centroid, oldCentroids[i]) < 1
    )) {
      break;
    }
  }
  
  return clusters;
}

function distance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt(
    Math.pow(a[0] - b[0], 2) +
    Math.pow(a[1] - b[1], 2) +
    Math.pow(a[2] - b[2], 2)
  );
}

function calculateColorThreshold(backgroundColor: [number, number, number]): number {
  // Calculate a threshold based on the background color's intensity
  const intensity = (backgroundColor[0] + backgroundColor[1] + backgroundColor[2]) / 3;
  return intensity > 128 ? 30 : 50; // Higher threshold for dark backgrounds
}

function isSimilarToBackground(
  r: number, g: number, b: number,
  backgroundColor: [number, number, number],
  threshold: number
): boolean {
  const distance = Math.sqrt(
    Math.pow(r - backgroundColor[0], 2) +
    Math.pow(g - backgroundColor[1], 2) +
    Math.pow(b - backgroundColor[2], 2)
  );
  return distance < threshold;
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