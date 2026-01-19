import React, { useState, useEffect, useRef } from 'react';
import { Camera, Sparkles, Lock, ArrowRight, User, BookOpen, Star, Menu, X, Download, ShoppingBag, Check, Shuffle, AlertCircle, Heart, Truck, ChevronRight } from 'lucide-react';

// --- CONFIGURATION ---
// PREVIEW MODE: Using hardcoded key for this demo environment.
// DEPLOYMENT INSTRUCTION: When you deploy to Netlify, replace the line below with:
// const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY; 

const THEMES = [
  { id: 'space', label: 'Space Hero', icon: '🚀', bg: 'from-blue-900 to-black', prompt: "a sci-fi space adventure" },
  { id: 'sundarban', label: 'Sundarbans', icon: '🐯', bg: 'from-green-800 to-green-600', prompt: "a jungle adventure in the Sundarbans with animals" },
  { id: 'magic', label: 'Magic Kingdom', icon: '🏰', bg: 'from-purple-600 to-indigo-900', prompt: "a magical fantasy kingdom with castles" },
  { id: 'cricket', label: 'Cricket Star', icon: '🏏', bg: 'from-green-500 to-emerald-700', prompt: "a sports story about becoming a cricket champion in Dhaka" },
];

const AUTO_PROMPTS = [
  "Finding a secret door in Lalbagh Fort that leads to the dinosaur age.",
  "A magical bicycle that flies over the traffic of Dhaka.",
  "Befriending a baby elephant in the tea gardens of Sylhet.",
  "Becoming the captain of a spaceship shaped like a giant Rickshaw.",
  "Discovering a hidden underwater city off the coast of St. Martin's Island.",
  "Saving the Royal Bengal Tigers with a magic flute.",
  "A rainy day where the raindrops turn into chocolate coins."
];

export default function App() {
  // Navigation State
  const [view, setView] = useState('landing'); // landing, create, loading, preview, payment
  
  // User Data State
  const [formData, setFormData] = useState({ 
    name: '', 
    gender: '', 
    theme: THEMES[0], 
    photo: null,       // Preview URL
    photoBase64: null, // Raw data for API
    photoMimeType: null,
    customPrompt: '' 
  });
  const [isSignedIn, setIsSignedIn] = useState(false);
  
  // App Logic State
  const [storyData, setStoryData] = useState(null);
  const [error, setError] = useState(null);
  
  // UI State
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Initializing...');

  // --- API LOGIC ---

  // 1. Generate Image using Gemini 2.5 Flash Image Preview ("Nano Banana")
  // Strictly using Nano Banana with NO fallback to Imagen.
  const generateImageWithNanoBanana = async (imagePrompt, referencePhotoBase64, mimeType, isCover = false, title = "") => {
    if (!API_KEY) {
        setError("Missing API Key. Check your Netlify Environment Variables.");
        return null;
    }

    try {
      let promptText = "";
      
      if (isCover) {
          promptText = `A children's book cover illustration. The title "${title}" must be clearly written on the image in a fun, bold, legible font. The scene depicts: ${imagePrompt}. The main character in the scene must look like the person in the provided reference image. Style: Children's book illustration, vibrant colors, high quality digital art.`;
      } else {
          promptText = `${imagePrompt}. The character in this illustration must look like the person in the provided reference image. Maintain the same facial features, hair, and skin tone. Style: Children's book illustration, vibrant colors, high quality digital art.`;
      }

      const parts = [{ text: promptText }];
      
      // Add reference image if available
      if (referencePhotoBase64 && mimeType) {
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: referencePhotoBase64
          }
        });
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: parts }],
            generationConfig: { responseModalities: ["IMAGE"] }
          })
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Nano Banana API Error (${response.status}):`, errText);
        throw new Error(`Primary model failed: ${response.status}`);
      }

      const data = await response.json();
      const base64Image = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
      
      if (!base64Image) throw new Error("No image data in Nano Banana response");
      
      return `data:image/png;base64,${base64Image}`;

    } catch (e) {
      console.error("Image generation error:", e);
      return `https://placehold.co/800x800/e2e8f0/64748b?text=Image+Generation+Failed`; 
    }
  };

  // 2. Main Orchestrator
  const generateStoryWithGemini = async () => {
    if (!API_KEY) {
        alert("System Error: API Key not found. Please configure the VITE_GEMINI_API_KEY environment variable.");
        return;
    }

    setView('loading');
    setLoadingProgress(5);
    setLoadingText('Connecting to AI Engine...');
    setError(null);

    const mainPrompt = formData.customPrompt || formData.theme.prompt;
    
    try {
      // --- Step A: Generate Text ---
      setLoadingText('Writing story text...');
      setLoadingProgress(15);

      const systemPrompt = `
        You are a professional children's book author. Write a short 5-page story for a child named ${formData.name}.
        The story must be about: ${mainPrompt}.
        
        Output ONLY valid JSON. Do not include markdown formatting like \`\`\`json.
        Structure:
        {
          "title": "Creative Story Title",
          "pages": [
            { "id": 1, "text": "Story text for page 1...", "image_prompt": "Visual description of page 1 scene, cute children's book style illustration, no text in image" },
            ... up to page 5
          ]
        }
        Make the story heartwarming and culturally relevant if the prompt implies it (e.g. Bangladesh context).
      `;

      // Using the Text model for the story generation
      const textResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }]
        })
      });

      if (!textResponse.ok) {
        const errorText = await textResponse.text();
        console.error("Gemini Text API Error:", errorText);
        throw new Error(`Failed to contact Gemini API: ${textResponse.status} ${textResponse.statusText}`);
      }

      const textData = await textResponse.json();
      let rawText = textData.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!rawText) throw new Error("No text returned from Gemini");

      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      let parsedStory;
      try {
        parsedStory = JSON.parse(rawText);
      } catch (jsonError) {
        console.error("JSON Parse Error:", jsonError, rawText);
        throw new Error("Failed to parse story data");
      }

      // Initial data set
      setStoryData(parsedStory);
      setLoadingProgress(30);

      // --- Step B: Generate Cover Art (With Text on Image) ---
      setLoadingText('Designing the cover...');
      
      const coverUrl = await generateImageWithNanoBanana(
          mainPrompt, // Use main prompt as scene base
          formData.photoBase64,
          formData.photoMimeType,
          true, // isCover
          parsedStory.title // Title to render
      );
      setLoadingProgress(45);

      // --- Step C: Generate Pages ---
      const pagesToPaint = 4;
      const updatedPages = [...parsedStory.pages];

      for (let i = 0; i < pagesToPaint && i < updatedPages.length; i++) {
        setLoadingText(`Painting page ${i + 1} of ${pagesToPaint}...`);
        
        // Pass user photo directly to Nano Banana for consistent character generation
        const imgUrl = await generateImageWithNanoBanana(
          updatedPages[i].image_prompt, 
          formData.photoBase64, 
          formData.photoMimeType
        );
        
        updatedPages[i].generatedImage = imgUrl;
        
        // Update progress
        setLoadingProgress(45 + Math.floor(((i + 1) / pagesToPaint) * 50));
      }

      // Save final data with cover and pages
      setStoryData({ ...parsedStory, pages: updatedPages, coverImage: coverUrl });
      setLoadingText('Finalizing your book...');
      
      setTimeout(() => {
        setLoadingProgress(100);
        setView('preview');
      }, 500);

    } catch (err) {
      console.error(err);
      setError(`Oops! ${err.message || "The AI got confused."} Please try again.`);
      setView('create');
    }
  };

  // --- Handlers ---

  const handleStart = () => setView('create');

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result.split(',')[1];
        setFormData({ 
          ...formData, 
          photo: URL.createObjectURL(file), // For UI preview
          photoBase64: base64String,        // For API
          photoMimeType: file.type          // For API
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAutoGeneratePrompt = () => {
    const randomPrompt = AUTO_PROMPTS[Math.floor(Math.random() * AUTO_PROMPTS.length)];
    setFormData({ ...formData, customPrompt: randomPrompt });
  };

  const handleGenerate = () => {
    if (!formData.name) return alert("Please enter a name!");
    generateStoryWithGemini();
  };

  const handleSignIn = () => {
    setIsSignedIn(true);
  };

  const handleBuy = (type) => {
    setView('payment');
  };

  // --- Components ---

  const Header = () => (
    <nav className="flex justify-between items-center p-4 bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-indigo-50">
      <div className="flex items-center gap-2" onClick={() => setView('landing')}>
        <div className="bg-indigo-600 text-white p-1.5 rounded-lg shadow-sm cursor-pointer">
          <BookOpen size={20} />
        </div>
        <span className="font-bold text-xl tracking-tight text-indigo-900 cursor-pointer">WonderTale</span>
      </div>
      {!isSignedIn && view !== 'landing' && (
        <button onClick={handleSignIn} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-4 py-2 rounded-full">
          Sign In
        </button>
      )}
      {isSignedIn && (
         <div className="h-9 w-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md border-2 border-white">
           {formData.name ? formData.name[0] : 'U'}
         </div>
      )}
    </nav>
  );

  const LandingPage = () => (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 pb-20">
      <Header />
      
      {/* Hero Section */}
      <div className="px-6 pt-12 pb-16 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold tracking-wide mb-6 animate-pulse border border-indigo-200">
          <Sparkles size={14} />
          <span>#1 Personalized Story Platform in Bangladesh 🇧🇩</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 leading-[1.1] mb-6">
          Make Your Child the <br className="hidden md:block"/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">Star of the Story</span>.
        </h1>
        <p className="text-lg md:text-xl text-slate-600 mb-8 leading-relaxed max-w-xl mx-auto font-medium">
          We use magic (AI) to turn a simple photo into a stunning 10-page hardcover adventure. The perfect gift they will cherish forever.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button 
            onClick={handleStart}
            className="w-full sm:w-auto bg-indigo-600 text-white py-4 px-10 rounded-2xl font-bold text-lg shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all flex items-center justify-center gap-2 border-b-4 border-indigo-800"
            >
            Create Free Story <ArrowRight size={22} />
            </button>
        </div>
        <p className="text-xs text-gray-400 font-semibold mt-4 tracking-wide uppercase">No credit card required • Instant Preview</p>
      </div>

      {/* How It Works - The 3 Steps */}
      <div className="bg-white py-20 border-y border-indigo-50 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-32 h-32 bg-yellow-100 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 opacity-50"></div>
        <div className="absolute bottom-0 right-0 w-40 h-40 bg-purple-100 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 opacity-50"></div>
        
        <div className="max-w-5xl mx-auto px-6 relative z-10">
            <div className="text-center mb-16">
                <h2 className="text-3xl font-extrabold text-slate-900 mb-4">How it works</h2>
                <p className="text-slate-500">Create a magical gift in less than 2 minutes</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-10">
                {/* Step 1 */}
                <div className="text-center relative p-6 rounded-3xl bg-indigo-50/50 border border-indigo-100">
                    <div className="w-16 h-16 bg-white text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md shadow-indigo-100 text-2xl font-bold border border-indigo-50">
                        <Camera size={32} />
                    </div>
                    <h3 className="font-bold text-xl mb-3 text-slate-800">1. Upload Photo</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">Take a quick selfie of your child. Our AI analyzes their features to keep the character looking just like them.</p>
                </div>
                {/* Step 2 */}
                <div className="text-center relative p-6 rounded-3xl bg-purple-50/50 border border-purple-100">
                     <div className="w-16 h-16 bg-white text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md shadow-purple-100 text-2xl font-bold border border-purple-50">
                        <Sparkles size={32} />
                     </div>
                    <h3 className="font-bold text-xl mb-3 text-slate-800">2. Pick a Theme</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">Choose from Space, Sundarbans, Magic Kingdom, or describe your own wild adventure.</p>
                </div>
                {/* Step 3 */}
                <div className="text-center relative p-6 rounded-3xl bg-green-50/50 border border-green-100">
                     <div className="w-16 h-16 bg-white text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md shadow-green-100 text-2xl font-bold border border-green-50">
                        <BookOpen size={32} />
                     </div>
                    <h3 className="font-bold text-xl mb-3 text-slate-800">3. Get the Book</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">See a free preview instantly. Order a high-quality PDF or a Hardcover book delivered to your door.</p>
                </div>
            </div>
        </div>
      </div>

      {/* Trust / Benefits */}
      <div className="py-16 px-6 max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-3xl shadow-xl shadow-indigo-100 border border-indigo-50 flex flex-col items-start hover:scale-[1.02] transition-transform">
                  <div className="bg-orange-100 p-3 rounded-xl mb-4 text-orange-600">
                    <Truck size={28} />
                  </div>
                  <h4 className="font-bold text-xl text-slate-900 mb-2">Physical Hardcover Delivery</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">We print on premium 170gsm glossy paper with a sturdy hardcover. Delivered anywhere in Bangladesh within 5-7 days.</p>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-xl shadow-pink-100 border border-pink-50 flex flex-col items-start hover:scale-[1.02] transition-transform">
                  <div className="bg-pink-100 p-3 rounded-xl mb-4 text-pink-600">
                    <Heart size={28} />
                  </div>
                  <h4 className="font-bold text-xl text-slate-900 mb-2">100% Unique & Personal</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">No two stories are the same. Your child is the unique hero of every single page, creating a keepsake they'll love.</p>
              </div>
          </div>
      </div>

      {/* Social Proof / Examples */}
      <div className="mt-8 px-4 overflow-x-hidden pb-12">
        <div className="flex items-center justify-center gap-2 mb-8">
            <div className="h-px bg-gray-200 w-12"></div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Recent Magic Created</p>
            <div className="h-px bg-gray-200 w-12"></div>
        </div>
        <div className="flex gap-6 overflow-x-auto pb-8 snap-x px-6 no-scrollbar">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-shrink-0 w-72 bg-white rounded-2xl shadow-lg border border-gray-100 p-4 snap-center hover:scale-[1.02] transition-transform cursor-pointer">
              <div className="aspect-[4/3] bg-slate-100 rounded-xl mb-4 overflow-hidden relative group">
                <img src={`https://placehold.co/400x300/indigo/white?text=Story+${i}`} alt="Example" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
              </div>
              <div className="px-1">
                <h3 className="font-bold text-slate-800 text-base mb-1">Rayan's Space Mission</h3>
                <div className="flex items-center justify-between">
                    <div className="flex text-yellow-400 text-xs gap-0.5">
                    <Star size={14} fill="currentColor" />
                    <Star size={14} fill="currentColor" />
                    <Star size={14} fill="currentColor" />
                    <Star size={14} fill="currentColor" />
                    <Star size={14} fill="currentColor" />
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium">2 mins ago</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Footer Trust Badges */}
      <div className="text-center pb-12 pt-8 opacity-70 border-t border-gray-100 mt-8">
          <p className="text-[10px] uppercase font-bold tracking-widest mb-4 text-gray-400">Secure Payments via</p>
          <div className="flex justify-center gap-6 text-sm font-bold text-slate-600 items-center">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-600"></span> bKash</span>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Nagad</span>
              <span className="text-gray-300">|</span>
              <span>Visa / Mastercard</span>
          </div>
          <p className="text-xs text-gray-400 mt-8">© 2024 WonderTale Bangladesh. All rights reserved.</p>
      </div>
    </div>
  );

  const CreatePage = () => (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-md mx-auto p-6">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4 flex items-center gap-2 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Who is the hero?</h2>
          <p className="text-gray-500 text-sm">We'll use this photo to draw the illustrations.</p>
        </div>

        {/* Step 1: Photo */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-6 text-center">
          <div 
            className="w-32 h-32 mx-auto bg-indigo-50 rounded-full border-2 border-dashed border-indigo-300 flex items-center justify-center mb-4 overflow-hidden relative cursor-pointer hover:bg-indigo-50 transition-colors"
            onClick={() => document.getElementById('photo-upload').click()}
          >
            {formData.photo ? (
              <img src={formData.photo} alt="Upload" className="w-full h-full object-cover" />
            ) : (
              <Camera className="text-indigo-400 w-10 h-10" />
            )}
            <input type="file" id="photo-upload" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
          </div>
          <p className="text-xs text-gray-400 font-medium">Tap to upload a clear selfie</p>
        </div>

        {/* Step 2: Details */}
        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Hero's Name</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-lg" 
              placeholder="e.g. Sadia"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Choose an Adventure</label>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setFormData({...formData, theme, customPrompt: ''})}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    formData.theme.id === theme.id && !formData.customPrompt
                    ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' 
                    : 'border-gray-200 bg-white hover:border-indigo-300'
                  }`}
                >
                  <span className="text-2xl mb-2 block">{theme.icon}</span>
                  <span className={`text-sm font-bold ${formData.theme.id === theme.id && !formData.customPrompt ? 'text-indigo-900' : 'text-gray-600'}`}>
                    {theme.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative">
              <label className="block text-sm font-bold text-gray-700 mb-2 flex justify-between items-center">
                <span>Or describe your own story...</span>
                <button 
                  onClick={handleAutoGeneratePrompt} 
                  className="text-xs text-indigo-600 flex items-center gap-1 font-bold hover:bg-indigo-50 px-2 py-1 rounded-md transition-colors"
                >
                  <Sparkles size={12} /> Auto Generate Idea
                </button>
              </label>
              <textarea
                value={formData.customPrompt}
                onChange={(e) => setFormData({...formData, customPrompt: e.target.value})}
                placeholder="E.g., A magical boat race on the Padma river..."
                className={`w-full p-4 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm min-h-[100px] transition-colors ${formData.customPrompt ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200'}`}
              />
              {!formData.customPrompt && (
                <button 
                  onClick={handleAutoGeneratePrompt}
                  className="absolute bottom-4 right-4 bg-indigo-100 text-indigo-700 p-2 rounded-lg text-xs font-bold hover:bg-indigo-200 transition-colors"
                >
                  ✨ Surprise Me
                </button>
              )}
            </div>
          </div>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={!formData.name}
          className="w-full bg-indigo-600 disabled:bg-gray-300 text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2"
        >
          <Sparkles size={20} /> Generate Story
        </button>
      </div>
    </div>
  );

  const LoadingPage = () => (
    <div className="min-h-screen bg-indigo-900 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20">
        <div className="absolute top-10 left-10 w-32 h-32 bg-purple-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-blue-500 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-xs">
        <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl mx-auto mb-8 flex items-center justify-center border border-white/20 shadow-2xl animate-bounce">
           <span className="text-4xl">{formData.theme.icon}</span>
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">Creating Magic...</h2>
        <p className="text-indigo-200 text-sm mb-8 h-6">{loadingText}</p>
        
        <div className="h-2 w-full bg-indigo-950 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-pink-500 to-indigo-400 transition-all duration-300 ease-out"
            style={{ width: `${loadingProgress}%` }}
          ></div>
        </div>
        <p className="text-xs text-indigo-400 mt-4 font-mono">{loadingProgress}% COMPLETE</p>
      </div>
    </div>
  );

  const PreviewPage = () => {
    // If we have story data, use it. Otherwise fall back to a safe loading state or error.
    if (!storyData) return <div>Loading...</div>;

    const visiblePages = storyData.pages.slice(0, 3); // Page 1, 2, 3
    const lockedPage = storyData.pages[3]; // Page 4

    return (
      <div className="fixed inset-0 bg-slate-900 flex flex-col z-50">
        {/* Top Bar */}
        <div className="bg-slate-900/90 backdrop-blur-sm p-4 flex justify-between items-center text-white z-10">
          <button onClick={() => setView('landing')} className="p-2 hover:bg-white/10 rounded-full">
            <X size={24} />
          </button>
          <div className="text-center">
            <h3 className="font-bold text-sm tracking-wide">PREVIEW MODE</h3>
            <p className="text-[10px] text-white/60">Swipe to turn pages</p>
          </div>
          <div className="w-8"></div> {/* spacer */}
        </div>

        {/* Scroll Container (The "Book") */}
        <div className="flex-1 overflow-x-auto snap-x snap-mandatory flex items-center hide-scrollbar">
          
          {/* 1. COVER PAGE */}
          <div className="w-full h-full flex-shrink-0 snap-center flex flex-col items-center justify-center p-6 bg-slate-900">
             <div className="w-full max-w-sm aspect-[3/4] bg-white rounded-r-2xl rounded-l-md shadow-2xl shadow-black overflow-hidden relative border-l-8 border-slate-800">
                <img 
                  src={storyData.coverImage || "https://placehold.co/800x1200?text=Cover"} 
                  className="w-full h-full object-cover" 
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-transparent pointer-events-none"></div>
                {/* Fallback title if image generation didn't include text nicely */}
                <div className="absolute bottom-10 left-0 right-0 text-center p-4">
                   <p className="text-white/90 text-sm font-medium drop-shadow-md">A story for {formData.name}</p>
                </div>
             </div>
             <div className="mt-6 flex items-center gap-2 text-white/50 text-sm animate-pulse">
               <span>Swipe to open</span> <ArrowRight size={16} />
             </div>
          </div>

          {/* 2. STORY PAGES (1-3) - Split into Image Page then Text Page */}
          {visiblePages.map((page, index) => (
            <React.Fragment key={page.id}>
              {/* IMAGE PAGE */}
              <div className="w-full h-full flex-shrink-0 snap-center flex flex-col items-center justify-center bg-[#fdfbf7] p-6 relative">
                  <div className="w-full max-w-sm aspect-square shadow-lg rounded-md overflow-hidden border-8 border-white bg-white">
                     {page.generatedImage ? (
                       <img src={page.generatedImage} className="w-full h-full object-cover" loading="lazy" />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-100">Image Loading...</div>
                     )}
                  </div>
                  <div className="absolute bottom-4 text-gray-300 text-[10px] font-mono">SCENE {index + 1}</div>
              </div>

              {/* TEXT PAGE */}
              <div className="w-full h-full flex-shrink-0 snap-center flex flex-col items-center justify-center bg-[#fdfbf7] p-10 relative text-center">
                  <div className="max-w-xs">
                    <div className="text-indigo-200 mb-6 flex justify-center"><Star size={24} /></div>
                    <p className="text-gray-800 font-serif text-xl leading-9 md:text-2xl">
                      {page.text}
                    </p>
                  </div>
                  <div className="absolute bottom-4 text-gray-300 text-[10px] font-mono">PAGE {index + 1}</div>
              </div>
            </React.Fragment>
          ))}

          {/* 3. LOCKED CONTENT (Page 4) */}
          {lockedPage && (
            <React.Fragment>
               {/* LOCKED TEXT PAGE (The Hook) - Visible */}
               <div className="w-full h-full flex-shrink-0 snap-center flex flex-col items-center justify-center bg-[#fdfbf7] p-10 relative text-center">
                  <div className="max-w-xs">
                    <div className="text-indigo-200 mb-6 flex justify-center"><Star size={24} /></div>
                    <p className="text-gray-800 font-serif text-xl leading-9 md:text-2xl">
                      {lockedPage.text}
                    </p>
                  </div>
                  <div className="absolute bottom-4 text-gray-300 text-[10px] font-mono">PAGE 4</div>
              </div>

              {/* LOCKED IMAGE PAGE - Blurred */}
              <div className="w-full h-full flex-shrink-0 snap-center flex flex-col items-center justify-center bg-[#fdfbf7] p-6 relative">
                  <div className="w-full max-w-sm aspect-square shadow-lg rounded-md overflow-hidden border-8 border-white bg-white relative">
                     <img 
                        src={lockedPage.generatedImage || "https://placehold.co/800x800"} 
                        className="w-full h-full object-cover blur-xl opacity-60 scale-110" 
                        loading="lazy" 
                     />
                     <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-xl flex flex-col items-center text-center max-w-[200px]">
                           <div className="bg-indigo-100 p-4 rounded-full mb-4 text-indigo-600">
                             <Lock size={28} />
                           </div>
                           <h3 className="font-bold text-lg text-slate-900 mb-2">See the Magic!</h3>
                           {!isSignedIn ? (
                             <button onClick={handleSignIn} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold text-xs shadow-lg hover:bg-indigo-700">
                               Sign In to Unlock
                             </button>
                           ) : (
                             <button className="w-full bg-gray-200 text-gray-500 py-2 rounded-lg font-bold text-xs cursor-not-allowed">
                               Unlocked (Preview)
                             </button>
                           )}
                        </div>
                     </div>
                  </div>
                  <div className="absolute bottom-4 text-gray-300 text-[10px] font-mono">SCENE 4 (LOCKED)</div>
              </div>
            </React.Fragment>
          )}

          {/* 4. UPSELL / FINAL PAGE */}
          <div className="w-full h-full flex-shrink-0 snap-center flex flex-col bg-indigo-900 p-8 text-center items-center justify-center relative overflow-hidden">
             {/* Decorative Circles */}
             <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-800 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3"></div>
             <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-900 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3"></div>

             <div className="relative z-10 max-w-sm w-full">
                <BookOpen size={48} className="text-white/20 mx-auto mb-6" />
                <h2 className="text-3xl font-bold text-white mb-2">Love this story?</h2>
                <p className="text-indigo-200 mb-10">Get the physical hardcover delivered to your doorstep in 5-7 days.</p>
                
                <div className="space-y-3">
                  <button onClick={() => handleBuy('physical')} className="w-full bg-white text-indigo-900 py-4 rounded-xl font-bold text-lg shadow-xl hover:bg-gray-50 flex items-center justify-center gap-3">
                    <ShoppingBag size={20} /> Order Hardcover <span className="text-sm bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded ml-auto">৳ 2,500</span>
                  </button>
                  <button onClick={() => handleBuy('digital')} className="w-full bg-indigo-800 text-white py-4 rounded-xl font-bold text-lg border border-indigo-700 hover:bg-indigo-700 flex items-center justify-center gap-3">
                    <Download size={20} /> PDF Download <span className="text-sm bg-indigo-900/50 text-indigo-200 px-2 py-0.5 rounded ml-auto">৳ 500</span>
                  </button>
                </div>
                
                <p className="text-xs text-indigo-400 mt-8">Secure payment via bKash / Nagad</p>
             </div>
          </div>

        </div>
      </div>
    );
  };

  const PaymentPage = () => (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-indigo-900 p-6 text-white text-center">
          <h2 className="text-xl font-bold mb-1">Secure Checkout</h2>
          <p className="text-indigo-200 text-sm">Complete your order</p>
        </div>
        
        <div className="p-6">
          {/* Order Summary */}
          <div className="flex gap-4 mb-6 pb-6 border-b border-gray-100">
            <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden">
              <img src={storyData?.coverImage || "https://placehold.co/600x600"} className="w-full h-full object-cover" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Hardcover Storybook</h3>
              <p className="text-xs text-gray-500">Theme: {formData.customPrompt ? 'Custom Adventure' : formData.theme.label}</p>
              <p className="text-indigo-600 font-bold mt-1">৳ 2,500</p>
            </div>
          </div>

          <form className="space-y-4">
             <div>
               <label className="text-xs font-bold text-gray-500 uppercase">Delivery Address</label>
               <input type="text" placeholder="House, Road, Area, City" className="w-full mt-1 p-3 border border-gray-200 rounded-lg text-sm focus:border-indigo-500 outline-none" />
             </div>
             
             <div>
               <label className="text-xs font-bold text-gray-500 uppercase">Phone Number</label>
               <input type="tel" placeholder="017..." className="w-full mt-1 p-3 border border-gray-200 rounded-lg text-sm focus:border-indigo-500 outline-none" />
             </div>

             <div className="pt-4">
               <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Payment Method</label>
               <div className="grid grid-cols-2 gap-3">
                 <div className="border border-pink-500 bg-pink-50 p-3 rounded-lg flex items-center gap-2 cursor-pointer ring-1 ring-pink-500">
                    <div className="w-4 h-4 rounded-full border-2 border-pink-600 flex items-center justify-center">
                      <div className="w-2 h-2 bg-pink-600 rounded-full"></div>
                    </div>
                    <span className="font-bold text-pink-700 text-sm">bKash</span>
                 </div>
                 <div className="border border-gray-200 p-3 rounded-lg flex items-center gap-2 cursor-pointer hover:border-orange-500">
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300"></div>
                    <span className="font-bold text-gray-600 text-sm">Nagad</span>
                 </div>
               </div>
             </div>
          </form>
          
          <button onClick={() => alert("Order Placed! (Demo)")} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold mt-8 shadow-lg hover:bg-indigo-700">
            Pay ৳ 2,500
          </button>
          
          <button onClick={() => setView('preview')} className="w-full text-center text-gray-400 text-sm mt-4 hover:text-gray-600">
            Cancel & Go Back
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="font-sans text-gray-900 antialiased">
      {view === 'landing' && <LandingPage />}
      {view === 'create' && <CreatePage />}
      {view === 'loading' && <LoadingPage />}
      {view === 'preview' && <PreviewPage />}
      {view === 'payment' && <PaymentPage />}
    </div>
  );
}