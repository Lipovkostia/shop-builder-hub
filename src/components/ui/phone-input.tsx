import * as React from "react";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { countryCodes, CountryCode, getDefaultCountry } from "@/lib/countryCodes";
import { cn } from "@/lib/utils";

interface PhoneInputProps {
  value: string;
  onChange: (fullPhone: string) => void;
  defaultCountryIso?: string;
  className?: string;
  id?: string;
}

export function PhoneInput({
  value,
  onChange,
  defaultCountryIso = "RU",
  className,
  id,
}: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(() => {
    const country = countryCodes.find(c => c.iso === defaultCountryIso);
    return country || getDefaultCountry();
  });

  // Extract phone number without country code from value
  const phoneNumber = useMemo(() => {
    if (!value) return "";
    // Remove the country code from the beginning
    const cleanValue = value.replace(/\D/g, "");
    const countryDigits = selectedCountry.code.replace(/\D/g, "");
    if (cleanValue.startsWith(countryDigits)) {
      return cleanValue.slice(countryDigits.length);
    }
    return cleanValue;
  }, [value, selectedCountry.code]);

  const handleCountryChange = (iso: string) => {
    const country = countryCodes.find(c => c.iso === iso);
    if (country) {
      setSelectedCountry(country);
      // Update the full phone with new country code
      if (phoneNumber) {
        onChange(`${country.code}${phoneNumber}`);
      }
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Remove all non-digit characters for storage
    const digits = inputValue.replace(/\D/g, "");
    // Combine country code with phone number
    onChange(`${selectedCountry.code}${digits}`);
  };

  // Format the phone number for display
  const formattedPhone = useMemo(() => {
    if (!phoneNumber) return "";
    // Just return digits, let user format as they type
    return phoneNumber;
  }, [phoneNumber]);

  return (
    <div className={cn("flex gap-2", className)}>
      <Select
        value={selectedCountry.iso}
        onValueChange={handleCountryChange}
      >
        <SelectTrigger className="w-[100px] sm:w-[120px] shrink-0">
          <SelectValue>
            <span className="flex items-center gap-1 overflow-hidden">
              <span className="text-base shrink-0">{selectedCountry.flag}</span>
              <span className="text-sm shrink-0">{selectedCountry.code}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {countryCodes.map((country) => (
            <SelectItem key={country.iso} value={country.iso}>
              <span className="flex items-center gap-2">
                <span className="text-base">{country.flag}</span>
                <span className="text-sm font-medium">{country.code}</span>
                <span className="text-sm text-muted-foreground truncate">
                  {country.name}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        placeholder={selectedCountry.placeholder}
        value={formattedPhone}
        onChange={handlePhoneChange}
        className="flex-1"
      />
    </div>
  );
}
