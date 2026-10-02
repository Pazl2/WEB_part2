import { useState, useEffect } from 'react';

export default function useLocalStorage(key, initialData) {
  const [value, setValue] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      let data = initialData;
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          data = JSON.parse(raw);
        }
      } catch {
        data = initialData;
      }
      setValue(data);
      setLoaded(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }, [value, loaded]);

  return [value, setValue, loaded];
}