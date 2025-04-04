'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import FileUpload from './components/FileUpload';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [showOverlay, setShowOverlay] = useState(false);
  const [showStickyButton, setShowStickyButton] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const stickyFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setShowStickyButton(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleFileSelect = async (file: File) => {
    // Validate file type - only accept PNG
    if (file.type !== 'image/png') {
      alert('Only PNG files are supported. Please select a PNG file.');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      alert('File size must be less than 10MB');
      return;
    }

    // Validate image dimensions
    const img = new (window.Image as any)();
    const objectUrl = URL.createObjectURL(file);
    
    try {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = objectUrl;
      });

      if (img.width > 4096 || img.height > 4096) {
        alert('Image dimensions must be less than 4096x4096 pixels');
        return;
      }

      setSelectedFile(file);
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Data = e.target?.result as string;
        // Store in localStorage instead of URL
        localStorage.setItem('uploadedImage', base64Data);
        router.push('/editor');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      alert('Failed to process image. Please try another file.');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleStickyButtonClick = () => {
    stickyFileInputRef.current?.click();
  };

  return (
    <main>
      <div className="navbar">
        <h2 className="navbar-text" onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>3D ANIMATOR</h2>
        <div className="navbar-buttons">
          <button className="nav-btn">Log In</button>
        </div>
      </div>
      
      <section className="section section1">
        <div className="text-container">
          <h1>Free online PNG to 3D-Animation</h1>
          <p>The free online PNG to animation tool from MelonMedia lets you upload your PNG image and convert it to a spinning 3D-animation in seconds.</p>
          
          <div className="big-container">
            <div className="button-textbox-container">
              <label htmlFor="sectionFileInput" className="btn">Upload your PNG</label>
              <input type="file" id="sectionFileInput" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
              <div className="textbox">
                <p>Free to use</p>
                <p>No payment required</p>
              </div>
            </div>
            <p className="additional-text">or drop a file, paste an image or URL.</p>
          </div>
        </div>
        <video
          autoPlay
          loop
          muted
          playsInline
          className="animated-webp"
          style={{ width: '50%', maxWidth: '400px', height: 'auto', marginRight: '8%', aspectRatio: '1/1' }}
        >
          <source src="/3d-logo-animation.webm" type="video/webm" />
        </video>
      </section>    

      <section className="section section2">
        <div className="content-container">
          <h2 className="section-title">How to animate your picture:</h2>
          <div className="box-container">
            <div className="box">
              <div className="box-content">
                <Image 
                  src="/upload.png" 
                  alt="Upload step" 
                  width={40} 
                  height={40} 
                  className="box-image" 
                />
                <div className="text-wrapper">
                  <h3 className="box-header">1. Upload.</h3>
                  <p className="box-description">Choose your prefered image from your photo library that is less than 2GB in size.</p>
                </div>
              </div>
            </div>
            <div className="box">
              <div className="box-content">
                <Image 
                  src="/animate.png" 
                  alt="Animate step" 
                  width={40} 
                  height={40} 
                  className="box-image" 
                />
                <div className="text-wrapper">
                  <h3 className="box-header">2. Animation.</h3>
                  <p className="box-description">Our program will cut out your logo and process it, then make it 3D and animate it!</p>
                </div>
              </div>
            </div>
            <div className="box">
              <div className="box-content">
                <Image 
                  src="/edit.png" 
                  alt="Edit step" 
                  width={40} 
                  height={40} 
                  className="box-image" 
                />
                <div className="text-wrapper">
                  <h3 className="box-header">3. Continue editing.</h3>
                  <p className="box-description">Your animation is done, but you can change properties like edge material and finish, speed, etc.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>    

      <section className="section section3">
        <div className="content-container">
          <div className="text-wrapper">
            <h2 className="section-header">Convert Your Photo to 3D Animation for Free</h2>
            <p className="section-description">3D animation adds depth and dimension to your visuals, making them more engaging and lifelike. Unlike static photos, 3D animations can be scaled, rotated, and manipulated in various ways without losing quality. Transform your photos into 3D animations for use in presentations, videos, advertisements, and more to create captivating and dynamic content.</p>
          </div>
          <Image 
            src="/pending.png" 
            alt="3D Animation Preview" 
            width={500} 
            height={400} 
            className="section-image"
          />
        </div>
      </section>

      <section className="section section4">
        <div className="content-container">
          <Image 
            src="/switch.png" 
            alt="Switch Preview" 
            width={500} 
            height={400} 
            className="section-image"
          />
          <div className="text-wrapper">
            <h2 className="section-header">An Easy-to-Use Photo to 3D Animation Converter</h2>
            <p className="section-description">The 3D animation converter allows you to transform your photos into immersive animations effortlessly. Simply upload a photo from your device, and watch it come to life as a 3D animation in seconds. Download your new 3D creation instantly and use it in your presentations, social media, or upcoming projects to wow your audience.</p>
          </div>
        </div>
      </section>    

      <FileUpload onFileSelect={handleFileSelect} />

      <div className={`overlay ${showOverlay ? 'block' : 'hidden'}`}>
        <Image src="/TL.png" className="overlay-corner top-left" alt="Top Left" width={90} height={90} />
        <Image src="/TR.png" className="overlay-corner top-right" alt="Top Right" width={90} height={90} />
        <Image src="/BL.png" className="overlay-corner bottom-left" alt="Bottom Left" width={90} height={90} />
        <Image src="/BR.png" className="overlay-corner bottom-right" alt="Bottom Right" width={90} height={90} />
        <div className="overlay-text">Drop image anywhere</div>
      </div>

      <button 
        className={`sticky-button ${showStickyButton ? 'show' : ''}`} 
        onClick={handleStickyButtonClick}
      >
        Upload PNG
      </button>
      <input
        type="file"
        ref={stickyFileInputRef}
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        accept="image/png"
        style={{ display: 'none' }}
      />
    </main>
  );
}
