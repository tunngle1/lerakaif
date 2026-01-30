
import React, { useState, useEffect, useMemo } from 'react';
import { COUNTRIES } from './constants';
// Added CountryVisit to the import list
import { UserData, Country, CountryVisit } from './types';
import { Search, Map, Globe, Camera, Calendar, Check, X, ChevronRight, LayoutGrid, Heart } from 'lucide-react';

const REGION_RU: Record<string, string> = {
  Asia: 'Азия',
  Europe: 'Европа',
  Africa: 'Африка',
  Americas: 'Америка',
  Oceania: 'Океания'
};

const displayNamesRu = new Intl.DisplayNames(['ru'], { type: 'region' });

const getCountryNameRu = (country: Country) => {
  const name = displayNamesRu.of(country.code);
  return name || country.name;
};

const getRegionNameRu = (region: string) => {
  return REGION_RU[region] || region;
};

const getCountryCoverImageUrl = (country: Country) => {
  return `https://source.unsplash.com/1200x900/?${encodeURIComponent(country.name)},travel,landscape`;
};

const getCountryCoverImageFallbackUrl = (country: Country) => {
  const upstream = `source.unsplash.com/1200x900/?${encodeURIComponent(country.name)},travel,landscape`;
  return `https://images.weserv.nl/?url=${encodeURIComponent(upstream)}`;
};

const getCountryFlagImageUrl = (country: Country) => {
  return `/flags/svg/${country.code.toLowerCase()}.svg`;
};

const getCountryFlagFallbackPngImageUrl = (country: Country) => {
  return `/flags/${country.code.toLowerCase()}.png`;
};

type CountryExtra = {
  capital?: string;
  population?: number;
  area?: number;
};

const formatPopulationRu = (value?: number) => {
  if (!value || !Number.isFinite(value)) return '';
  return value.toLocaleString('ru-RU');
};

const formatAreaRu = (value?: number) => {
  if (!value || !Number.isFinite(value)) return '';
  return value.toLocaleString('ru-RU');
};

const App: React.FC = () => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'visited'>('all');
  const [userData, setUserData] = useState<UserData>(() => {
    const saved = localStorage.getItem('wanderlust_data');
    return saved ? JSON.parse(saved) : {};
  });
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [countryExtraByCode, setCountryExtraByCode] = useState<Record<string, CountryExtra>>(() => {
    const cached = localStorage.getItem('country_extra_v1');
    return cached ? JSON.parse(cached) : {};
  });

  const lightboxPhotos = selectedCountry ? (userData[selectedCountry.code]?.photos || []) : [];
  const lightboxPhoto = (lightboxIndex != null && lightboxIndex >= 0 && lightboxIndex < lightboxPhotos.length)
    ? lightboxPhotos[lightboxIndex]
    : null;

  const closeLightbox = () => setLightboxIndex(null);

  const showPrevLightbox = () => {
    if (lightboxIndex == null) return;
    if (lightboxPhotos.length === 0) return;
    setLightboxIndex((lightboxIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length);
  };

  const showNextLightbox = () => {
    if (lightboxIndex == null) return;
    if (lightboxPhotos.length === 0) return;
    setLightboxIndex((lightboxIndex + 1) % lightboxPhotos.length);
  };

  useEffect(() => {
    if (lightboxIndex == null) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLightbox();
        return;
      }
      if (e.key === 'ArrowLeft') {
        showPrevLightbox();
        return;
      }
      if (e.key === 'ArrowRight') {
        showNextLightbox();
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIndex, lightboxPhotos.length]);

  useEffect(() => {
    try {
      localStorage.setItem('wanderlust_data', JSON.stringify(userData));
      if (storageError) setStorageError(null);
    } catch {
      setStorageError('Не удалось сохранить данные. Возможно, закончилось место в памяти браузера. Попробуй удалить несколько фото или загружать меньшие.');
    }
  }, [userData]);

  useEffect(() => {
    if (Object.keys(countryExtraByCode).length > 0) return;

    const controller = new AbortController();
    const run = async () => {
      try {
        const res = await fetch('https://restcountries.com/v3.1/all?fields=cca2,capital,population,area', {
          signal: controller.signal
        });
        if (!res.ok) return;
        const data = (await res.json()) as Array<{
          cca2?: string;
          capital?: string[];
          population?: number;
          area?: number;
        }>;

        const next: Record<string, CountryExtra> = {};
        for (const item of data) {
          const code = item.cca2;
          if (!code) continue;
          next[code.toUpperCase()] = {
            capital: item.capital?.[0],
            population: item.population,
            area: item.area
          };
        }
        setCountryExtraByCode(next);
        localStorage.setItem('country_extra_v1', JSON.stringify(next));
      } catch {
        return;
      }
    };

    void run();
    return () => controller.abort();
  }, [countryExtraByCode]);

  const filteredCountries = useMemo(() => {
    return COUNTRIES.filter(c => {
      const nameRu = getCountryNameRu(c);
      const matchesSearch = nameRu.toLowerCase().includes(search.toLowerCase());
      const matchesTab = activeTab === 'all' || (userData[c.code]?.visited);
      return matchesSearch && matchesTab;
    });
  }, [search, activeTab, userData]);

  // Fix: Cast Object.values(userData) to CountryVisit[] to avoid 'unknown' type error on v.visited
  const visitedCount = (Object.values(userData) as CountryVisit[]).filter(v => v.visited).length;
  const progress = Math.round((visitedCount / COUNTRIES.length) * 100);

  const toggleVisit = (code: string) => {
    setUserData(prev => ({
      ...prev,
      [code]: {
        ...prev[code],
        visited: !prev[code]?.visited,
        photos: prev[code]?.photos || []
      }
    }));
  };

  const updateDate = (code: string, date: string) => {
    setUserData(prev => ({
      ...prev,
      [code]: { ...prev[code], date }
    }));
  };

  const addPhoto = (code: string, photoDataUrl: string) => {
    setUserData(prev => {
      const current = prev[code] || { visited: false, date: '', photos: [] };
      return {
        ...prev,
        [code]: {
          ...current,
          photos: [...(current.photos || []), photoDataUrl]
        }
      };
    });
  };

  const addPhotos = (code: string, photoDataUrls: string[]) => {
    if (photoDataUrls.length === 0) return;
    setUserData(prev => {
      const current = prev[code] || { visited: false, date: '', photos: [] };
      return {
        ...prev,
        [code]: {
          ...current,
          photos: [...(current.photos || []), ...photoDataUrls]
        }
      };
    });
  };

  const compressImageToDataUrl = (file: File, maxSize = 1600, quality = 0.82) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read_failed'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('image_decode_failed'));
        img.onload = () => {
          const { width, height } = img;
          const scale = Math.min(1, maxSize / Math.max(width, height));
          const targetW = Math.max(1, Math.round(width * scale));
          const targetH = Math.max(1, Math.round(height * scale));

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('canvas_failed'));
            return;
          }
          ctx.drawImage(img, 0, 0, targetW, targetH);

          const out = canvas.toDataURL('image/jpeg', quality);
          resolve(out);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (code: string, index: number) => {
    setUserData(prev => {
      const newPhotos = [...(prev[code]?.photos || [])];
      newPhotos.splice(index, 1);
      return {
        ...prev,
        [code]: { ...prev[code], photos: newPhotos }
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, code: string) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const next: string[] = [];
    for (const file of files) {
      try {
        const dataUrl = await compressImageToDataUrl(file);
        next.push(dataUrl);
      } catch {
        setStorageError('Не удалось обработать одно из фото. Попробуй другое изображение.');
      }
    }

    addPhotos(code, next);
    e.target.value = '';
  };

  return (
    <div className="min-h-screen pb-20 md:pb-0 md:pl-0">
      {storageError && (
        <div className="px-6 py-4 bg-white border-b border-black/5 text-sm opacity-80 md:px-24">
          {storageError}
        </div>
      )}
      {/* Header Section - Editorial Look */}
      <header className="px-6 pt-8 pb-8 bg-white md:px-24 md:pt-12">
        <div className="flex flex-col items-start gap-4 mb-8">
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-serif font-light leading-tight">
            TraveLera
          </h1>
          <div className="w-full h-px bg-black opacity-10 mt-4"></div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest opacity-40 mb-1">Посещено</p>
            <p className="text-3xl font-serif">{visitedCount} / {COUNTRIES.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest opacity-40 mb-1">Прогресс</p>
            <p className="text-3xl font-serif">{progress}%</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 md:px-24 max-w-7xl mx-auto">
        <div className="sticky top-0 z-20 bg-[#faf9f6] pt-4 pb-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
            <input
              type="text"
              placeholder="Поиск страны..."
              className="w-full bg-white border-none py-4 pl-12 pr-4 rounded-none editorial-shadow focus:ring-1 focus:ring-black transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-4 text-xs uppercase tracking-widest transition-all ${activeTab === 'all' ? 'bg-black text-white' : 'bg-white opacity-60 hover:opacity-100'}`}
            >
              Все страны
            </button>
            <button
              onClick={() => setActiveTab('visited')}
              className={`px-6 py-4 text-xs uppercase tracking-widest transition-all ${activeTab === 'visited' ? 'bg-black text-white' : 'bg-white opacity-60 hover:opacity-100'}`}
            >
              Мои путешествия
            </button>
          </div>
        </div>

        {/* Country Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-4">
          {filteredCountries.map(country => {
            const visit = userData[country.code];
            const isVisited = visit?.visited;
            const countryNameRu = getCountryNameRu(country);
            const regionRu = getRegionNameRu(country.region);
            const extra = countryExtraByCode[country.code];
            const capital = extra?.capital;
            const population = extra?.population;
            const area = extra?.area;
            const facts: string[] = [];
            const populationText = formatPopulationRu(population);
            if (populationText) facts.push(`Население: ${populationText}`);
            const areaText = formatAreaRu(area);
            if (areaText) facts.push(`Площадь: ${areaText} км²`);
            
            return (
              <div 
                key={country.code} 
                className="group relative bg-white overflow-hidden transition-all duration-500 hover:-translate-y-1 editorial-shadow cursor-pointer"
                onClick={() => setSelectedCountry(country)}
              >
                {/* Thumbnail/Placeholder */}
                <div className="aspect-[4/3] bg-gray-50 overflow-hidden relative">
                   <img 
                      src={getCountryCoverImageUrl(country)} 
                      alt={countryNameRu}
                      onError={(e) => {
                        const img = e.currentTarget;
                        const step = img.dataset.fallbackStep || '0';

                        if (step === '0') {
                          img.dataset.fallbackStep = '1';
                          img.style.filter = '';
                          img.src = getCountryCoverImageFallbackUrl(country);
                          return;
                        }

                        if (step === '1') {
                          img.dataset.fallbackStep = '2';
                          img.src = getCountryFlagImageUrl(country);
                          img.style.filter = '';
                          return;
                        }

                        if (step === '2') {
                          img.dataset.fallbackStep = '3';
                          img.src = getCountryFlagFallbackPngImageUrl(country);
                          img.style.filter = '';
                          return;
                        }
                      }}
                      className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-700"
                   />
                   {isVisited && (
                     <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-2 rounded-full">
                        <Check className="w-4 h-4 text-black" />
                     </div>
                   )}
                </div>
                <div className="p-6">
                  <p className="text-[10px] uppercase tracking-[0.2em] opacity-40 mb-2">{regionRu}</p>
                  <h3 className="text-2xl font-serif mb-1 group-hover:italic transition-all">{countryNameRu}</h3>
                  <p className="text-xs opacity-60 mb-2">Столица: {capital || '—'}</p>
                  {facts.length > 0 && (
                    <div className="space-y-1">
                      {facts.slice(0, 2).map((fact, idx) => (
                        <p key={idx} className="text-xs opacity-50">{fact}</p>
                      ))}
                    </div>
                  )}
                  {visit?.date && (
                    <p className="text-xs opacity-50">{new Date(visit.date).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {filteredCountries.length === 0 && (
          <div className="py-20 text-center">
            <p className="font-serif italic text-2xl opacity-30">Ничего не найдено по вашему запросу.</p>
          </div>
        )}
      </main>

      {/* Full Screen Modal for Country Details */}
      {selectedCountry && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white transition-all duration-500 animate-in fade-in slide-in-from-bottom-4">
          <div className="min-h-screen flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-8 md:px-24">
              <button 
                onClick={() => setSelectedCountry(null)}
                className="p-4 -ml-4 hover:opacity-50 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="text-center flex flex-col items-center">
                 <p className="text-[10px] uppercase tracking-[0.3em] opacity-40 mb-1">{getRegionNameRu(selectedCountry.region)}</p>
                 <h2 className="text-4xl md:text-5xl font-serif italic">{getCountryNameRu(selectedCountry)}</h2>
                 <p className="text-xs opacity-60 mt-3">Столица: {countryExtraByCode[selectedCountry.code]?.capital || '—'}</p>
                 <div className="mt-2 space-y-1">
                   {(() => {
                     const extra = countryExtraByCode[selectedCountry.code];
                     const facts: string[] = [];
                     const populationText = formatPopulationRu(extra?.population);
                     if (populationText) facts.push(`Население: ${populationText}`);
                     const areaText = formatAreaRu(extra?.area);
                     if (areaText) facts.push(`Площадь: ${areaText} км²`);
                     return facts.slice(0, 2).map((fact, idx) => (
                       <p key={idx} className="text-xs opacity-50">{fact}</p>
                     ));
                   })()}
                 </div>
              </div>
              <button 
                onClick={() => toggleVisit(selectedCountry.code)}
                className={`p-4 rounded-full transition-all ${userData[selectedCountry.code]?.visited ? 'bg-black text-white' : 'border border-black/10 hover:border-black'}`}
              >
                <Heart className={`w-6 h-6 ${userData[selectedCountry.code]?.visited ? 'fill-current' : ''}`} />
              </button>
            </div>

            <div className="px-6 md:px-24 pb-20 max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-12">
              {/* Left Column: Details */}
              <div className="md:col-span-4 space-y-12">
                <section>
                  <label className="text-xs uppercase tracking-widest opacity-40 block mb-4">Статус</label>
                  <button 
                    onClick={() => toggleVisit(selectedCountry.code)}
                    className={`w-full py-6 text-xs uppercase tracking-widest border transition-all ${userData[selectedCountry.code]?.visited ? 'bg-black text-white border-black' : 'border-black/10'}`}
                  >
                    {userData[selectedCountry.code]?.visited ? 'Убрать из посещённых' : 'Отметить как посещённую'}
                  </button>
                </section>

                <section>
                  <label className="text-xs uppercase tracking-widest opacity-40 block mb-4">Дата поездки</label>
                  <input 
                    type="date"
                    className="w-full bg-[#faf9f6] border-none p-6 text-sm focus:ring-1 focus:ring-black"
                    value={userData[selectedCountry.code]?.date || ''}
                    onChange={(e) => updateDate(selectedCountry.code, e.target.value)}
                  />
                </section>

                <section>
                  <label className="text-xs uppercase tracking-widest opacity-40 block mb-4">Добавить фото</label>
                  <label className="w-full flex items-center justify-center gap-4 py-8 border-2 border-dashed border-black/10 cursor-pointer hover:border-black/30 transition-all group">
                    <Camera className="w-6 h-6 opacity-30 group-hover:opacity-100 transition-all" />
                    <span className="text-xs uppercase tracking-widest opacity-50 group-hover:opacity-100">Загрузить фото</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      multiple
                      onChange={(e) => handleFileChange(e, selectedCountry.code)}
                    />
                  </label>
                </section>
              </div>

              {/* Right Column: Album */}
              <div className="md:col-span-8">
                <label className="text-xs uppercase tracking-widest opacity-40 block mb-8">Галерея</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {(userData[selectedCountry.code]?.photos || []).map((photo, idx) => (
                    <div key={idx} className="aspect-square relative group bg-gray-100">
                      <img
                        src={photo}
                        alt="Memory"
                        className="w-full h-full object-cover cursor-zoom-in"
                        onClick={() => setLightboxIndex(idx)}
                      />
                      <button 
                        onClick={(e) => { e.stopPropagation(); removePhoto(selectedCountry.code, idx); }}
                        className="absolute top-2 right-2 bg-black/50 backdrop-blur-md p-1.5 opacity-0 group-hover:opacity-100 transition-all text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(!userData[selectedCountry.code]?.photos || userData[selectedCountry.code]?.photos.length === 0) && (
                    <div className="col-span-full h-64 flex flex-col items-center justify-center border border-black/5 bg-[#faf9f6]">
                       <p className="font-serif italic text-xl opacity-20">Сохраняй свои моменты здесь.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button
            className="absolute top-4 right-4 p-3 text-white/90 hover:text-white transition-all"
            onClick={(e) => {
              e.stopPropagation();
              closeLightbox();
            }}
          >
            <X className="w-6 h-6" />
          </button>

          {lightboxPhotos.length > 1 && (
            <button
              className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 p-3 text-white/90 hover:text-white transition-all"
              onClick={(e) => {
                e.stopPropagation();
                showPrevLightbox();
              }}
              aria-label="Предыдущее фото"
            >
              <ChevronRight className="w-7 h-7 rotate-180" />
            </button>
          )}

          {lightboxPhotos.length > 1 && (
            <button
              className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 p-3 text-white/90 hover:text-white transition-all"
              onClick={(e) => {
                e.stopPropagation();
                showNextLightbox();
              }}
              aria-label="Следующее фото"
            >
              <ChevronRight className="w-7 h-7" />
            </button>
          )}

          <img
            src={lightboxPhoto}
            alt="Фото"
            className="max-w-full max-h-[85vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Footer Nav for Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/5 p-4 flex justify-around items-center md:hidden z-40 backdrop-blur-md bg-white/80">
        <button onClick={() => { setActiveTab('all'); window.scrollTo(0,0); }} className={`flex flex-col items-center gap-1 ${activeTab === 'all' ? 'text-black' : 'text-gray-400'}`}>
          <Globe className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-tighter">Страны</span>
        </button>
        <button onClick={() => { setActiveTab('visited'); window.scrollTo(0,0); }} className={`flex flex-col items-center gap-1 ${activeTab === 'visited' ? 'text-black' : 'text-gray-400'}`}>
          <Map className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-tighter">Дневник</span>
        </button>
      </nav>

      {/* Desktop Navigation Decoration */}
      <div className="hidden md:flex fixed right-12 top-1/2 -translate-y-1/2 flex-col gap-12 text-[10px] uppercase tracking-[0.5em] [writing-mode:vertical-lr] opacity-30">
        <span>Путешествия по миру</span>
        <span>•</span>
        <span>Каждая поездка — история</span>
      </div>
    </div>
  );
};

export default App;
