import React, { createContext, useContext, useEffect, useState } from "react";

const FrameMultiplierContext = createContext<number>(1);

const measureFrameRate = () => {
  return new Promise<number>((resolve) => {
    let frames = 0;
    const startTime = performance.now();

    const countFrames = () => {
      frames++;
      if (performance.now() - startTime < 1000) {
        requestAnimationFrame(countFrames);
      } else {
        resolve(frames);
      }
    };

    requestAnimationFrame(countFrames);
  });
};

export const FrameMultiplierProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [frameMultiplier, setFrameMultiplier] = useState<number>(1);

  useEffect(() => {
    const calculateMultiplier = async () => {
      //speeding up the game based on the refresh rate
      await new Promise((res) => setTimeout(res, 800));
      const refreshRate = await measureFrameRate();
      let multiplier = refreshRate >= 65 ? 1 : 1.5;
      setFrameMultiplier(multiplier);
      console.log("Refresh rate: ", refreshRate);
      console.log("Frame multiplier: ", multiplier);
    };

    calculateMultiplier();
  }, []);

  return (
    <FrameMultiplierContext.Provider value={frameMultiplier}>
      {children}
    </FrameMultiplierContext.Provider>
  );
};

export const useFrameMultiplier = () => {
  return useContext(FrameMultiplierContext);
};

