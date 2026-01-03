
import { GoogleGenAI, Type } from "@google/genai";

export interface TopicResponse {
  category: string;
  topic: string;
}

const TOPIC_BANK: TopicResponse[] = [
  // LOCATIONS
  { category: "Location", topic: "Submarine" }, { category: "Location", topic: "Zoo" },
  { category: "Location", topic: "Library" }, { category: "Location", topic: "Casino" },
  { category: "Location", topic: "Space Station" }, { category: "Location", topic: "Theater" },
  { category: "Location", topic: "Airport" }, { category: "Location", topic: "Circus" },
  { category: "Location", topic: "Police Station" }, { category: "Location", topic: "Hospital" },
  { category: "Location", topic: "Amusement Park" }, { category: "Location", topic: "Art Gallery" },
  { category: "Location", topic: "Bowling Alley" }, { category: "Location", topic: "Campground" },
  { category: "Location", topic: "Cruise Ship" }, { category: "Location", topic: "Desert" },
  { category: "Location", topic: "Embassy" }, { category: "Location", topic: "Fire Station" },
  { category: "Location", topic: "Gas Station" }, { category: "Location", topic: "School" },
  { category: "Location", topic: "Ice Rink" }, { category: "Location", topic: "Jungle" },
  { category: "Location", topic: "Kitchen" }, { category: "Location", topic: "Lighthouse" },
  { category: "Location", topic: "Military Base" }, { category: "Location", topic: "Nightclub" },
  { category: "Location", topic: "Opera House" }, { category: "Location", topic: "Pharmacy" },
  { category: "Location", topic: "Restaurant" }, { category: "Location", topic: "Ski Resort" },
  { category: "Location", topic: "Treehouse" }, { category: "Location", topic: "Bunker" },
  { category: "Location", topic: "Volcano" }, { category: "Location", topic: "Water Park" },
  { category: "Location", topic: "Castle" }, { category: "Location", topic: "Prison" },
  { category: "Location", topic: "Subway" }, { category: "Location", topic: "Graveyard" },

  // JOBS
  { category: "Job", topic: "Astronaut" }, { category: "Job", topic: "Chef" },
  { category: "Job", topic: "Plumber" }, { category: "Job", topic: "Surgeon" },
  { category: "Job", topic: "Spy" }, { category: "Job", topic: "Architect" },
  { category: "Job", topic: "Baker" }, { category: "Job", topic: "Captain" },
  { category: "Job", topic: "Detective" }, { category: "Job", topic: "Electrician" },
  { category: "Job", topic: "Farmer" }, { category: "Job", topic: "Gardener" },
  { category: "Job", topic: "Hairdresser" }, { category: "Job", topic: "Janitor" },
  { category: "Job", topic: "Knight" }, { category: "Job", topic: "Librarian" },
  { category: "Job", topic: "Mechanic" }, { category: "Job", topic: "Nurse" },
  { category: "Job", topic: "Pilot" }, { category: "Job", topic: "Reporter" },
  { category: "Job", topic: "Soldier" }, { category: "Job", topic: "Teacher" },
  { category: "Job", topic: "Veterinarian" }, { category: "Job", topic: "Waiter" },
  { category: "Job", topic: "Zookeeper" }, { category: "Job", topic: "Artist" },
  { category: "Job", topic: "Bodyguard" }, { category: "Job", topic: "Clown" },
  { category: "Job", topic: "Dentist" }, { category: "Job", topic: "Fisherman" },
  { category: "Job", topic: "Gladiator" }, { category: "Job", topic: "Judge" },
  { category: "Job", topic: "Lifeguard" }, { category: "Job", topic: "Magician" },
  { category: "Job", topic: "Ninja" }, { category: "Job", topic: "Pirate" },

  // OBJECTS
  { category: "Object", topic: "Telescope" }, { category: "Object", topic: "Guitar" },
  { category: "Object", topic: "Anchor" }, { category: "Object", topic: "Backpack" },
  { category: "Object", topic: "Camera" }, { category: "Object", topic: "Diamond" },
  { category: "Object", topic: "Flashlight" }, { category: "Object", topic: "Goggles" },
  { category: "Object", topic: "Helmet" }, { category: "Object", topic: "Joystick" },
  { category: "Object", topic: "Keyboard" }, { category: "Object", topic: "Lantern" },
  { category: "Object", topic: "Microscope" }, { category: "Object", topic: "Piano" },
  { category: "Object", topic: "Umbrella" }, { category: "Object", topic: "Violin" },
  { category: "Object", topic: "Watch" }, { category: "Object", topic: "Yo-yo" },
  { category: "Object", topic: "Globe" }, { category: "Object", topic: "Hammer" },
  { category: "Object", topic: "Jukebox" }, { category: "Object", topic: "Kettle" },
  { category: "Object", topic: "Balloon" }, { category: "Object", topic: "Compass" },
  { category: "Object", topic: "Drone" }, { category: "Object", topic: "Fridge" },

  // ANIMALS
  { category: "Animal", topic: "Platypus" }, { category: "Animal", topic: "Kangaroo" },
  { category: "Animal", topic: "Flamingo" }, { category: "Animal", topic: "Dolphin" },
  { category: "Animal", topic: "Elephant" }, { category: "Animal", topic: "Giraffe" },
  { category: "Animal", topic: "Hippo" }, { category: "Animal", topic: "Jellyfish" },
  { category: "Animal", topic: "Koala" }, { category: "Animal", topic: "Lion" },
  { category: "Animal", topic: "Monkey" }, { category: "Animal", topic: "Penguin" },
  { category: "Animal", topic: "Shark" }, { category: "Animal", topic: "Tiger" },
  { category: "Animal", topic: "Whale" }, { category: "Animal", topic: "Zebra" },
  { category: "Animal", topic: "Alligator" }, { category: "Animal", topic: "Bear" },
];

const getLocalTopic = () => TOPIC_BANK[Math.floor(Math.random() * TOPIC_BANK.length)];

export const generateGameTopic = async (): Promise<TopicResponse> => {
  // We wrap the entire execution in a try-catch to ensure that if the API key is missing
  // or the constructor throws, we gracefully fall back to local topics.
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.warn("No API Key found, using local topics.");
      return getLocalTopic();
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Generate a creative, common-knowledge topic for a social deduction game. It MUST be a single, simple noun (e.g., 'Toaster', 'Eiffel Tower', 'Penguin'). Avoid activities, phrases, or verbs.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description: "A simple category like 'Location', 'Job', 'Animal', 'Object', or 'Food'",
            },
            topic: {
              type: Type.STRING,
              description: "A single noun representing the secret word",
            },
          },
          required: ["category", "topic"],
        },
      },
    });

    if (response.text) {
      try {
        return JSON.parse(response.text.trim()) as TopicResponse;
      } catch (e) {
        return getLocalTopic();
      }
    }
    return getLocalTopic();
  } catch (error) {
    console.error("Gemini API Error (using fallback):", error);
    return getLocalTopic();
  }
};
