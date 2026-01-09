export interface CountryCode {
  code: string;
  name: string;
  iso: string;
  flag: string;
  placeholder: string;
}

export const countryCodes: CountryCode[] = [
  // СНГ страны (приоритет)
  { code: "+7", name: "Россия", iso: "RU", flag: "🇷🇺", placeholder: "999 123 45 67" },
  { code: "+7", name: "Казахстан", iso: "KZ", flag: "🇰🇿", placeholder: "701 123 45 67" },
  { code: "+380", name: "Украина", iso: "UA", flag: "🇺🇦", placeholder: "50 123 45 67" },
  { code: "+375", name: "Беларусь", iso: "BY", flag: "🇧🇾", placeholder: "29 123 45 67" },
  { code: "+998", name: "Узбекистан", iso: "UZ", flag: "🇺🇿", placeholder: "90 123 45 67" },
  { code: "+996", name: "Кыргызстан", iso: "KG", flag: "🇰🇬", placeholder: "555 123 456" },
  { code: "+992", name: "Таджикистан", iso: "TJ", flag: "🇹🇯", placeholder: "90 123 45 67" },
  { code: "+993", name: "Туркменистан", iso: "TM", flag: "🇹🇲", placeholder: "65 123 456" },
  { code: "+994", name: "Азербайджан", iso: "AZ", flag: "🇦🇿", placeholder: "50 123 45 67" },
  { code: "+374", name: "Армения", iso: "AM", flag: "🇦🇲", placeholder: "91 123 456" },
  { code: "+995", name: "Грузия", iso: "GE", flag: "🇬🇪", placeholder: "555 12 34 56" },
  { code: "+373", name: "Молдова", iso: "MD", flag: "🇲🇩", placeholder: "60 123 456" },
  
  // Популярные страны
  { code: "+1", name: "США", iso: "US", flag: "🇺🇸", placeholder: "201 555 1234" },
  { code: "+44", name: "Великобритания", iso: "GB", flag: "🇬🇧", placeholder: "7911 123456" },
  { code: "+49", name: "Германия", iso: "DE", flag: "🇩🇪", placeholder: "151 12345678" },
  { code: "+33", name: "Франция", iso: "FR", flag: "🇫🇷", placeholder: "6 12 34 56 78" },
  { code: "+39", name: "Италия", iso: "IT", flag: "🇮🇹", placeholder: "312 345 6789" },
  { code: "+34", name: "Испания", iso: "ES", flag: "🇪🇸", placeholder: "612 34 56 78" },
  { code: "+48", name: "Польша", iso: "PL", flag: "🇵🇱", placeholder: "512 345 678" },
  { code: "+90", name: "Турция", iso: "TR", flag: "🇹🇷", placeholder: "501 234 56 78" },
  { code: "+86", name: "Китай", iso: "CN", flag: "🇨🇳", placeholder: "131 2345 6789" },
  { code: "+81", name: "Япония", iso: "JP", flag: "🇯🇵", placeholder: "90 1234 5678" },
  { code: "+82", name: "Южная Корея", iso: "KR", flag: "🇰🇷", placeholder: "10 1234 5678" },
  { code: "+91", name: "Индия", iso: "IN", flag: "🇮🇳", placeholder: "91234 56789" },
  { code: "+971", name: "ОАЭ", iso: "AE", flag: "🇦🇪", placeholder: "50 123 4567" },
  { code: "+972", name: "Израиль", iso: "IL", flag: "🇮🇱", placeholder: "50 123 4567" },
  { code: "+66", name: "Таиланд", iso: "TH", flag: "🇹🇭", placeholder: "81 234 5678" },
  { code: "+84", name: "Вьетнам", iso: "VN", flag: "🇻🇳", placeholder: "91 234 56 78" },
  { code: "+55", name: "Бразилия", iso: "BR", flag: "🇧🇷", placeholder: "11 91234 5678" },
  { code: "+52", name: "Мексика", iso: "MX", flag: "🇲🇽", placeholder: "1 234 567 8901" },
  { code: "+54", name: "Аргентина", iso: "AR", flag: "🇦🇷", placeholder: "9 11 2345 6789" },
  { code: "+20", name: "Египет", iso: "EG", flag: "🇪🇬", placeholder: "100 123 4567" },
  { code: "+27", name: "ЮАР", iso: "ZA", flag: "🇿🇦", placeholder: "71 123 4567" },
  { code: "+61", name: "Австралия", iso: "AU", flag: "🇦🇺", placeholder: "412 345 678" },
  { code: "+64", name: "Новая Зеландия", iso: "NZ", flag: "🇳🇿", placeholder: "21 123 4567" },
  { code: "+1", name: "Канада", iso: "CA", flag: "🇨🇦", placeholder: "204 234 5678" },
];

export const getCountryByIso = (iso: string): CountryCode | undefined => {
  return countryCodes.find(c => c.iso === iso);
};

export const getDefaultCountry = (): CountryCode => {
  return countryCodes[0]; // Россия
};
