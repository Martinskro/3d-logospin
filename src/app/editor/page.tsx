'use client';

import { useState, useEffect, useRef } from 'react';
import LogoScene from '../components/LogoScene';
import { processImage, ProcessedImage } from '../utils/imageProcessor';
import { useSearchParams, useRouter } from 'next/navigation';
import html2canvas from 'html2canvas';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const SIZE_PRESETS = [
  { label: 'Portrait', width: 1080, height: 1920 },
  { label: 'Square', width: 1080, height: 1080 },
  { label: 'HD', width: 1920, height: 1080 },
  { label: '2K', width: 2048, height: 1080 },
];

export default function Editor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [processedImage, setProcessedImage] = useState<ProcessedImage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animationSpeed, setAnimationSpeed] = useState<number | ''>(50);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [canvasWidth, setCanvasWidth] = useState<number | ''>(1080);
  const [canvasHeight, setCanvasHeight] = useState<number | ''>(1920);
  const [logoScale, setLogoScale] = useState<number | ''>(100);
  const [depth, setDepth] = useState<number | ''>(50);
  const [widthError, setWidthError] = useState<string | null>(null);
  const [heightError, setHeightError] = useState<string | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [edgeColor, setEdgeColor] = useState('#000000');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadDuration, setDownloadDuration] = useState(5); // Duration in seconds
  const [downloadLoops, setDownloadLoops] = useState(1); // Number of loops
  const [downloadMode, setDownloadMode] = useState<'duration' | 'loops'>('duration');

  // Update container size on mount and resize
  useEffect(() => {
    const updateContainerSize = () => {
      if (previewContainerRef.current) {
        const container = previewContainerRef.current;
        setContainerSize({
          width: container.clientWidth - 80,
          height: container.clientHeight - 80
        });
      }
    };

    updateContainerSize();
    window.addEventListener('resize', updateContainerSize);
    return () => window.removeEventListener('resize', updateContainerSize);
  }, []);

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    try {
      const processed = await processImage(file);
      setProcessedImage(processed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle image from localStorage on mount
  useEffect(() => {
    const imageData = localStorage.getItem('uploadedImage');
    if (imageData) {
      // Convert base64 to File object
      fetch(imageData)
        .then(res => res.blob())
        .then(blob => {
          // Get the file type from the blob
          const fileType = blob.type;
          const file = new File([blob], 'image.' + fileType.split('/')[1], { type: fileType });
          handleFileUpload(file);
        })
        .catch(err => {
          setError('Failed to load image');
        });
    }
  }, []);

  // Handle file upload and processing
  useEffect(() => {
    // Listen for file upload events
    const handleFileSelect = (e: Event) => {
      const input = e.target as HTMLInputElement;
      if (input.files && input.files[0]) {
        handleFileUpload(input.files[0]);
      }
    };

    document.addEventListener('change', handleFileSelect);
    return () => document.removeEventListener('change', handleFileSelect);
  }, []);

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCanvasWidth(value === '' ? '' : parseInt(value));
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCanvasHeight(value === '' ? '' : parseInt(value));
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.currentTarget.select();
  };

  const validateWidth = (value: number | '') => {
    setWidthError(null);
    if (value === '') {
      setWidthError('Please enter a width');
      return false;
    }
    if (isNaN(value)) {
      setWidthError('Please enter a valid number');
      return false;
    }
    if (value < 200) {
      setWidthError('min. 200px');
      return false;
    }
    if (value > 2048) {
      setWidthError('max. 2048px');
      return false;
    }
    return true;
  };

  const validateHeight = (value: number | '') => {
    setHeightError(null);
    if (value === '') {
      setHeightError('Please enter a height');
      return false;
    }
    if (isNaN(value)) {
      setHeightError('Please enter a valid number');
      return false;
    }
    if (value < 200) {
      setHeightError('min. 200px');
      return false;
    }
    if (value > 2048) {
      setHeightError('max. 2048px');
      return false;
    }
    return true;
  };

  const handleWidthBlur = () => {
    validateWidth(canvasWidth);
  };

  const handleHeightBlur = () => {
    validateHeight(canvasHeight);
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAnimationSpeed(value === '' ? '' : parseInt(value));
  };

  const handleScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLogoScale(value === '' ? '' : parseInt(value));
  };

  const handleDepthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDepth(value === '' ? '' : parseInt(value));
  };

  const handlePresetSelect = (preset: typeof SIZE_PRESETS[0]) => {
    setCanvasWidth(preset.width);
    setCanvasHeight(preset.height);
  };

  const getDisplaySize = () => {
    const width = typeof canvasWidth === 'number' ? canvasWidth : 0;
    const height = typeof canvasHeight === 'number' ? canvasHeight : 0;
    
    const scale = Math.min(
      containerSize.width / width,
      containerSize.height / height,
      1
    );
    return {
      width: width * scale,
      height: height * scale
    };
  };

  const displaySize = getDisplaySize();

  const handleDownload = async () => {
    if (!canvasRef.current || !processedImage) return;
    
    setIsDownloading(true);
    try {
      // Create a temporary canvas with the same dimensions
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvasRef.current.width;
      tempCanvas.height = canvasRef.current.height;
      const tempCtx = tempCanvas.getContext('2d');

      if (!tempCtx) {
        throw new Error('Could not get 2D context');
      }

      // Create a MediaRecorder with WebM format
      const stream = tempCanvas.captureStream(30); // 30 FPS
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const webmBlob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(webmBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '3d-logo-animation.webm';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsDownloading(false);
      };

      // Function to draw the current frame
      const drawFrame = () => {
        // Clear the temporary canvas with the background color
        if (backgroundColor === 'transparent') {
          tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        } else {
          tempCtx.fillStyle = backgroundColor;
          tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        }
        
        // Draw the WebGL canvas
        tempCtx.drawImage(canvasRef.current!, 0, 0);
      };

      // Calculate recording duration based on mode
      let recordingDuration = 5000; // Default 5 seconds
      if (downloadMode === 'duration') {
        recordingDuration = downloadDuration * 1000; // Convert seconds to milliseconds
      } else {
        // Calculate duration based on number of loops and current rotation speed
        const rotationSpeed = Number(animationSpeed);
        const timePerLoop = 360 / rotationSpeed; // Time in seconds for one complete rotation
        recordingDuration = timePerLoop * downloadLoops * 1000; // Convert to milliseconds
      }

      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      
      // Set up animation frame loop
      const startTime = Date.now();
      const animate = () => {
        drawFrame();
        if (Date.now() - startTime < recordingDuration) {
          requestAnimationFrame(animate);
        } else {
          mediaRecorder.stop();
        }
      };
      
      animate();
    } catch (error) {
      console.error('Error recording video:', error);
      setIsDownloading(false);
    }
  };

  const handleSizePreset = (width: number, height: number) => {
    setCanvasWidth(width);
    setCanvasHeight(height);
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="navbar">
        <h2 className="navbar-text" onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>3D ANIMATOR</h2>
        <div className="navbar-buttons">
          <button className="nav-btn">Log In</button>
        </div>
      </div>

      <div className="editor-container">
        <div className="editor-sidebar">
          <div className="editor-controls">
            {isProcessing && (
              <div className="processing-message">
                Processing image...
              </div>
            )}
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            {!processedImage && (
              <div className="upload-prompt">
                <input
                  type="file"
                  accept="image/*"
                  className="file-input"
                />
                <p>Upload an image to begin</p>
              </div>
            )}
            
            {processedImage && (
              <>
                <div className="control-group">
                  <h3>Canvas Size</h3>
                  <div className="size-presets">
                    {SIZE_PRESETS.map((preset) => (
                      <button 
                        key={preset.label}
                        className={`preset-btn ${canvasWidth === preset.width && canvasHeight === preset.height ? 'active' : ''}`}
                        onClick={() => handlePresetSelect(preset)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="size-inputs">
                    <div className="size-input-group">
                      <label>Width:</label>
                      <div className="size-input-wrapper">
                        <input 
                          type="number" 
                          value={canvasWidth}
                          onChange={handleWidthChange}
                          onBlur={handleWidthBlur}
                          onDoubleClick={handleDoubleClick}
                          className="size-input"
                          min="200"
                          max="2048"
                        />
                        <span className="size-unit">px</span>
                      </div>
                      {widthError && <div className="error-message">{widthError}</div>}
                    </div>
                    <div className="size-input-group">
                      <label>Height:</label>
                      <div className="size-input-wrapper">
                        <input 
                          type="number"
                          value={canvasHeight}
                          onChange={handleHeightChange}
                          onBlur={handleHeightBlur}
                          onDoubleClick={handleDoubleClick}
                          className="size-input"
                          min="200"
                          max="2048"
                        />
                        <span className="size-unit">px</span>
                      </div>
                      {heightError && <div className="error-message">{heightError}</div>}
                    </div>
                  </div>
                </div>

                <div className="control-group">
                  <h3>Animation Speed</h3>
                  <div className="slider-container">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={animationSpeed}
                      onChange={(e) => setAnimationSpeed(parseInt(e.target.value))}
                      className="slider"
                    />
                    <div className="slider-input-wrapper">
                      <input
                        type="number"
                        value={animationSpeed}
                        onChange={handleSpeedChange}
                        className="slider-input"
                        min="0"
                        max="100"
                      />
                      <span className="slider-unit">%</span>
                    </div>
                  </div>
                </div>

                <div className="control-group">
                  <h3>Logo Scale</h3>
                  <div className="slider-container">
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={logoScale}
                      onChange={(e) => setLogoScale(parseInt(e.target.value))}
                      className="slider"
                    />
                    <div className="slider-input-wrapper">
                      <input
                        type="number"
                        value={logoScale}
                        onChange={handleScaleChange}
                        className="slider-input"
                        min="0"
                        max="200"
                      />
                      <span className="slider-unit">%</span>
                    </div>
                  </div>
                </div>

                <div className="control-group">
                  <h3>Extrusion Depth</h3>
                  <div className="slider-container">
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={depth}
                      onChange={(e) => setDepth(parseInt(e.target.value))}
                      className="slider"
                    />
                    <div className="slider-input-wrapper">
                      <input
                        type="number"
                        value={depth}
                        onChange={handleDepthChange}
                        className="slider-input"
                        min="0"
                        max="200"
                      />
                      <span className="slider-unit">%</span>
                    </div>
                  </div>
                </div>

                <div className="control-group">
                  <h3>Edge Color</h3>
                  <div className="color-picker">
                    <input
                      type="color"
                      value={edgeColor}
                      onChange={(e) => setEdgeColor(e.target.value)}
                    />
                  </div>
                </div>

                <div className="control-group">
                  <h3>Background Color</h3>
                  <div className="color-picker">
                    <input
                      type="color"
                      value={backgroundColor === 'transparent' ? '#ffffff' : backgroundColor}
                      onChange={(e) => {
                        const newColor = e.target.value;
                        setBackgroundColor(newColor);
                      }}
                    />
                  </div>
                  <div className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={backgroundColor === 'transparent'}
                      onChange={(e) => {
                        const isTransparent = e.target.checked;
                        setBackgroundColor(isTransparent ? 'transparent' : '#ffffff');
                      }}
                    />
                    <span>Transparent Background</span>
                  </div>
                </div>

                <div className="control-group">
                  <h3>Download Settings</h3>
                  <div className="download-controls">
                    <div className="download-mode-selector">
                      <label>
                        <input
                          type="radio"
                          checked={downloadMode === 'duration'}
                          onChange={() => setDownloadMode('duration')}
                        />
                        Duration (seconds)
                      </label>
                      <label>
                        <input
                          type="radio"
                          checked={downloadMode === 'loops'}
                          onChange={() => setDownloadMode('loops')}
                        />
                        Number of Loops
                      </label>
                    </div>
                    {downloadMode === 'duration' ? (
                      <div className="duration-control">
                        <label>Duration (seconds):</label>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={downloadDuration}
                          onChange={(e) => setDownloadDuration(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
                        />
                      </div>
                    ) : (
                      <div className="loops-control">
                        <label>Number of Loops:</label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={downloadLoops}
                          onChange={(e) => setDownloadLoops(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                        />
                      </div>
                    )}
                  </div>
                  <button 
                    className="download-button" 
                    onClick={handleDownload}
                    disabled={isDownloading}
                  >
                    {isDownloading ? 'Recording...' : 'Download Video'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="preview-container" ref={previewContainerRef}>
          {processedImage ? (
            <div 
              className="preview-canvas"
              style={{ 
                width: `${displaySize.width}px`,
                height: `${displaySize.height}px`,
              }}
              data-size={`${typeof canvasWidth === 'number' ? canvasWidth : ''} × ${typeof canvasHeight === 'number' ? canvasHeight : ''}px`}
            >
              <LogoScene 
                imageUrl={processedImage.url}
                animationSpeed={typeof animationSpeed === 'number' ? animationSpeed : 50}
                backgroundColor={backgroundColor}
                canvasWidth={typeof canvasWidth === 'number' ? canvasWidth : 0}
                canvasHeight={typeof canvasHeight === 'number' ? canvasHeight : 0}
                logoScale={typeof logoScale === 'number' ? logoScale / 100 : 1}
                depth={typeof depth === 'number' ? depth / 100 : 0.5}
                color={edgeColor}
                mask={processedImage.mask}
                onCanvasRef={(ref) => canvasRef.current = ref}
              />
            </div>
          ) : (
            <div className="upload-placeholder">
              <p>Upload an image to preview</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
} 