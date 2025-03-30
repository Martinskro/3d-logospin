'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

export default function FileUpload({ onFileSelect }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleWindowDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current++;
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDragging(true);
      }
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current === 0) {
        setIsDragging(false);
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      
      const dataTransfer = e.dataTransfer;
      if (dataTransfer && dataTransfer.files && dataTransfer.files.length > 0) {
        const file = dataTransfer.files[0];
        if (file.type.startsWith('image/')) {
          onFileSelect(file);
        } else {
          alert('Please drop an image file');
        }
      }
    };

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);
    window.addEventListener('dragover', (e) => e.preventDefault());

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
      window.removeEventListener('dragover', (e) => e.preventDefault());
    };
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        onFileSelect(file);
      } else {
        alert('Please drop an image file');
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  return (
    <>
      <div
        className={`overlay ${isDragging ? 'visible' : ''}`}
      >
        <Image 
          src="/TL.png" 
          alt="Top Left Corner" 
          width={90} 
          height={90} 
          className="overlay-corner top-left" 
        />
        <Image 
          src="/TR.png" 
          alt="Top Right Corner" 
          width={90} 
          height={90} 
          className="overlay-corner top-right" 
        />
        <Image 
          src="/BL.png" 
          alt="Bottom Left Corner" 
          width={90} 
          height={90} 
          className="overlay-corner bottom-left" 
        />
        <Image 
          src="/BR.png" 
          alt="Bottom Right Corner" 
          width={90} 
          height={90} 
          className="overlay-corner bottom-right" 
        />
        <div className="overlay-text">Drop image anywhere</div>
      </div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{ width: '100%', height: '100%', position: 'fixed', top: 0, left: 0, pointerEvents: isDragging ? 'all' : 'none', zIndex: 10000 }}
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInput}
        accept="image/*"
        style={{ display: 'none' }}
      />
    </>
  );
} 