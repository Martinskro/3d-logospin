'use client';

import { useState, useEffect, useRef } from 'react';
import LogoScene from '../components/LogoScene';
import { processImage, ProcessedImage } from '../utils/imageProcessor';

const SIZE_PRESETS = [
  { label: 'HD', width: 1920, height: 1080 },
  { label: '2K', width: 2048, height: 1080 },
  { label: 'Square', width: 1080, height: 1080 },
  { label: 'Portrait', width: 1080, height: 1920 },
];

export default function Editor() {
  const [processedImage, setProcessedImage] = useState<ProcessedImage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animationSpeed, setAnimationSpeed] = useState<number | ''>(50);
  const [material, setMaterial] = useState('glossy');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [canvasWidth, setCanvasWidth] = useState<number | ''>(600);
  const [canvasHeight, setCanvasHeight] = useState<number | ''>(400);
  const [logoScale, setLogoScale] = useState<number | ''>(100);
  const [widthError, setWidthError] = useState<string | null>(null);
  const [heightError, setHeightError] = useState<string | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);

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

  // Handle file upload and processing
  useEffect(() => {
    const handleFileUpload = async (file: File) => {
      setIsProcessing(true);
      setError(null);
      try {
        const processed = await processImage(file);
        setProcessedImage(processed);
        // Set initial canvas size based on processed image
        setCanvasWidth(processed.width);
        setCanvasHeight(processed.height);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process image');
      } finally {
        setIsProcessing(false);
      }
    };

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

  const handleDownload = () => {
    // Implementation of handleDownload function
  };

  const handleSizePreset = (width: number, height: number) => {
    setCanvasWidth(width);
    setCanvasHeight(height);
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="navbar">
        <h2 className="navbar-text">3D ANIMATOR</h2>
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
                      min="1"
                      max="100"
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
                        min="1"
                        max="100"
                      />
                      <span className="slider-unit">%</span>
                    </div>
                  </div>
                </div>

                <div className="control-group">
                  <h3>Material</h3>
                  <select 
                    value={material} 
                    onChange={(e) => setMaterial(e.target.value)}
                    className="material-select"
                  >
                    <option value="glossy">Glossy</option>
                    <option value="matte">Matte</option>
                    <option value="metallic">Metallic</option>
                  </select>
                </div>

                <div className="control-group">
                  <h3>Background Color</h3>
                  <div className="color-picker">
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                    />
                  </div>
                </div>

                <button className="download-btn" onClick={handleDownload}>
                  Download
                </button>
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
                material={material}
                backgroundColor={backgroundColor}
                canvasWidth={typeof canvasWidth === 'number' ? canvasWidth : 0}
                canvasHeight={typeof canvasHeight === 'number' ? canvasHeight : 0}
                logoScale={typeof logoScale === 'number' ? logoScale / 100 : 1}
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