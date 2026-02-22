import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Search, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface CityPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiKey: string;
  onCitySelect: (city: string, address: string) => void;
  currentCity?: string;
}

declare global {
  interface Window {
    ymaps3?: any;
  }
}

export function CityPickerDialog({
  open,
  onOpenChange,
  apiKey,
  onCitySelect,
  currentCity,
}: CityPickerDialogProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAddress, setSelectedAddress] = useState("");
  const [selectedCity, setSelectedCity] = useState(currentCity || "");
  const [loading, setLoading] = useState(true);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ text: string; coords: [number, number] }>>([]);

  // Load Yandex Maps script
  useEffect(() => {
    if (!open || !apiKey) return;
    
    if (window.ymaps3) {
      setScriptLoaded(true);
      return;
    }

    const existingScript = document.getElementById("ymaps3-script");
    if (existingScript) {
      existingScript.addEventListener("load", () => setScriptLoaded(true));
      return;
    }

    const script = document.createElement("script");
    script.id = "ymaps3-script";
    script.src = `https://api-maps.yandex.ru/v3/?apikey=${apiKey}&lang=ru_RU`;
    script.async = true;
    script.onload = () => {
      setScriptLoaded(true);
    };
    script.onerror = () => {
      console.error("Failed to load Yandex Maps script");
      setLoading(false);
    };
    document.head.appendChild(script);
  }, [open, apiKey]);

  // Initialize map
  useEffect(() => {
    if (!open || !scriptLoaded || !mapContainerRef.current || !window.ymaps3) return;

    let cancelled = false;

    const initMap = async () => {
      try {
        await window.ymaps3.ready;

        if (cancelled || !mapContainerRef.current) return;

        const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker, YMapListener } = window.ymaps3;

        // Clear previous map
        if (mapInstanceRef.current) {
          mapInstanceRef.current.destroy();
        }

        const map = new YMap(mapContainerRef.current, {
          location: {
            center: [37.6173, 55.7558], // Moscow
            zoom: 10,
          },
        });

        map.addChild(new YMapDefaultSchemeLayer({}));
        map.addChild(new YMapDefaultFeaturesLayer({}));

        // Add click listener
        const listener = new YMapListener({
          layer: "any",
          onClick: async (obj: any, event: any) => {
            if (event?.coordinates) {
              const [lng, lat] = event.coordinates;
              await reverseGeocode(lat, lng, map, YMapMarker);
            }
          },
        });
        map.addChild(listener);

        mapInstanceRef.current = map;
        setLoading(false);
      } catch (err) {
        console.error("Error initializing map:", err);
        setLoading(false);
      }
    };

    initMap();

    return () => {
      cancelled = true;
    };
  }, [open, scriptLoaded]);

  // Reverse geocode coordinates to address
  const reverseGeocode = useCallback(async (lat: number, lng: number, map?: any, YMapMarker?: any) => {
    try {
      const response = await fetch(
        `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${lng},${lat}&format=json&lang=ru_RU`
      );
      const data = await response.json();
      const geoObject = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;

      if (geoObject) {
        const address = geoObject.metaDataProperty?.GeocoderMetaData?.text || "";
        const components = geoObject.metaDataProperty?.GeocoderMetaData?.Address?.Components || [];
        const cityComponent = components.find(
          (c: any) => c.kind === "locality"
        );
        const city = cityComponent?.name || "";

        setSelectedAddress(address);
        setSelectedCity(city);

        // Update marker
        if (map || mapInstanceRef.current) {
          const targetMap = map || mapInstanceRef.current;
          const MarkerClass = YMapMarker || window.ymaps3?.YMapMarker;

          if (markerRef.current) {
            targetMap.removeChild(markerRef.current);
          }

          if (MarkerClass) {
            const markerEl = document.createElement("div");
            markerEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="hsl(var(--primary))" stroke="hsl(var(--primary-foreground))" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
            markerEl.style.transform = "translate(-16px, -32px)";

            const marker = new MarkerClass({
              coordinates: [lng, lat],
              draggable: false,
            }, markerEl);

            targetMap.addChild(marker);
            markerRef.current = marker;
          }
        }
      }
    } catch (err) {
      console.error("Reverse geocode error:", err);
    }
  }, [apiKey]);

  // Search address
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !apiKey) return;

    try {
      const response = await fetch(
        `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${encodeURIComponent(searchQuery)}&format=json&lang=ru_RU&results=5`
      );
      const data = await response.json();
      const members = data?.response?.GeoObjectCollection?.featureMember || [];

      const results = members.map((m: any) => {
        const pos = m.GeoObject.Point.pos.split(" ");
        return {
          text: m.GeoObject.metaDataProperty?.GeocoderMetaData?.text || m.GeoObject.name,
          coords: [parseFloat(pos[0]), parseFloat(pos[1])] as [number, number],
        };
      });

      setSuggestions(results);
    } catch (err) {
      console.error("Search error:", err);
    }
  }, [searchQuery, apiKey]);

  const handleSuggestionSelect = useCallback(async (suggestion: { text: string; coords: [number, number] }) => {
    setSuggestions([]);
    setSearchQuery(suggestion.text);

    const [lng, lat] = suggestion.coords;

    // Move map to location
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setLocation({
        center: suggestion.coords,
        zoom: 15,
        duration: 500,
      });
    }

    await reverseGeocode(lat, lng);
  }, [reverseGeocode]);

  const handleConfirm = useCallback(() => {
    if (selectedCity || selectedAddress) {
      onCitySelect(selectedCity, selectedAddress);
      onOpenChange(false);
    }
  }, [selectedCity, selectedAddress, onCitySelect, onOpenChange]);

  // Cleanup map on close
  useEffect(() => {
    if (!open && mapInstanceRef.current) {
      try {
        mapInstanceRef.current.destroy();
      } catch {}
      mapInstanceRef.current = null;
      markerRef.current = null;
      setLoading(true);
      setSuggestions([]);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Выберите ваш город
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!e.target.value.trim()) setSuggestions([]);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Введите адрес или город..."
              className="pl-9 pr-10"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSuggestions([]);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionSelect(s)}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-start gap-2"
                >
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span>{s.text}</span>
                </button>
              ))}
            </div>
          )}

          {/* Map */}
          <div className="relative rounded-lg overflow-hidden border" style={{ height: 350 }}>
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/50">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
          </div>

          {/* Selected address */}
          {selectedAddress && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="text-muted-foreground text-xs mb-1">Выбранный адрес:</p>
              <p className="font-medium">{selectedAddress}</p>
              {selectedCity && (
                <p className="text-muted-foreground text-xs mt-1">Город: {selectedCity}</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button onClick={handleConfirm} disabled={!selectedCity && !selectedAddress}>
              Подтвердить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}