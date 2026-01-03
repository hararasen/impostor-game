import { GoogleGenAI, Type } from "@google/genai";

export interface TopicResponse {
  category: string;
  topic: string;
}

// Massive local bank of ~260 common-knowledge topics across multiple categories
const TOPIC_BANK: TopicResponse[] = [
  // LOCATIONS (45)
  { category: "Location", topic: "Submarine" }, { category: "Location", topic: "Zoo" },
  { category: "Location", topic: "Library" }, { category: "Location", topic: "Casino" },
  { category: "Location", topic: "Space Station" }, { category: "Location", topic: "Movie Theater" },
  { category: "Location", topic: "Airport" }, { category: "Location", topic: "Circus" },
  { category: "Location", topic: "Police Station" }, { category: "Location", topic: "Hospital" },
  { category: "Location", topic: "Amusement Park" }, { category: "Location", topic: "Art Gallery" },
  { category: "Location", topic: "Bowling Alley" }, { category: "Location", topic: "Camping Ground" },
  { category: "Location", topic: "Cruise Ship" }, { category: "Location", topic: "Desert" },
  { category: "Location", topic: "Embassy" }, { category: "Location", topic: "Fire Station" },
  { category: "Location", topic: "Gas Station" }, { category: "Location", topic: "High School" },
  { category: "Location", topic: "Ice Skating Rink" }, { category: "Location", topic: "Jungle" },
  { category: "Location", topic: "Kitchen" }, { category: "Location", topic: "Lighthouse" },
  { category: "Location", topic: "Military Base" }, { category: "Location", topic: "Nightclub" },
  { category: "Location", topic: "Opera House" }, { category: "Location", topic: "Pharmacy" },
  { category: "Location", topic: "Quick-Sand Pit" }, { category: "Location", topic: "Restaurant" },
  { category: "Location", topic: "Ski Resort" }, { category: "Location", topic: "Treehouse" },
  { category: "Location", topic: "Underground Bunker" }, { category: "Location", topic: "Volcano" },
  { category: "Location", topic: "Water Park" }, { category: "Location", topic: "Yoga Studio" },
  { category: "Location", topic: "Zen Garden" }, { category: "Location", topic: "Post Office" },
  { category: "Location", topic: "Castle" }, { category: "Location", topic: "Prison" },
  { category: "Location", topic: "Subway Station" }, { category: "Location", topic: "Grocery Store" },
  { category: "Location", topic: "Graveyard" }, { category: "Location", topic: "Waterfall" },
  { category: "Location", topic: "Gym" },

  // JOBS / PROFESSIONS (45)
  { category: "Job", topic: "Astronaut" }, { category: "Job", topic: "Chef" },
  { category: "Job", topic: "Influencer" }, { category: "Job", topic: "Plumber" },
  { category: "Job", topic: "Surgeon" }, { category: "Job", topic: "Spy" },
  { category: "Job", topic: "Architect" }, { category: "Job", topic: "Baker" },
  { category: "Job", topic: "Captain" }, { category: "Job", topic: "Detective" },
  { category: "Job", topic: "Electrician" }, { category: "Job", topic: "Farmer" },
  { category: "Job", topic: "Gardener" }, { category: "Job", topic: "Hairdresser" },
  { category: "Job", topic: "Ice Cream Man" }, { category: "Job", topic: "Janitor" },
  { category: "Job", topic: "Knight" }, { category: "Job", topic: "Librarian" },
  { category: "Job", topic: "Mechanic" }, { category: "Job", topic: "Nurse" },
  { category: "Job", topic: "Oceanographer" }, { category: "Job", topic: "Pilot" },
  { category: "Job", topic: "Quarry Worker" }, { category: "Job", topic: "Reporter" },
  { category: "Job", topic: "Soldier" }, { category: "Job", topic: "Teacher" },
  { category: "Job", topic: "Umpire" }, { category: "Job", topic: "Veterinarian" },
  { category: "Job", topic: "Waiter" }, { category: "Job", topic: "Yoga Instructor" },
  { category: "Job", topic: "Zookeeper" }, { category: "Job", topic: "Artist" },
  { category: "Job", topic: "Bodyguard" }, { category: "Job", topic: "Clown" },
  { category: "Job", topic: "Dentist" }, { category: "Job", topic: "Editor" },
  { category: "Job", topic: "Fisherman" }, { category: "Job", topic: "Gladiator" },
  { category: "Job", topic: "Judge" }, { category: "Job", topic: "Life Guard" },
  { category: "Job", topic: "Magician" }, { category: "Job", topic: "Ninja" },
  { category: "Job", topic: "Optometrist" }, { category: "Job", topic: "Pirate" },
  { category: "Job", topic: "Rockstar" },

  // ACTIVITIES (45)
  { category: "Activity", topic: "Camping" }, { category: "Activity", topic: "Skydiving" },
  { category: "Activity", topic: "Scuba Diving" }, { category: "Activity", topic: "Yoga" },
  { category: "Activity", topic: "Surfing" }, { category: "Activity", topic: "Baking" },
  { category: "Activity", topic: "Chess" }, { category: "Activity", topic: "Dancing" },
  { category: "Activity", topic: "Eating" }, { category: "Activity", topic: "Fishing" },
  { category: "Activity", topic: "Golfing" }, { category: "Activity", topic: "Hiking" },
  { category: "Activity", topic: "Ice Skating" }, { category: "Activity", topic: "Juggling" },
  { category: "Activity", topic: "Knitting" }, { category: "Activity", topic: "Laughing" },
  { category: "Activity", topic: "Mountain Climbing" }, { category: "Activity", topic: "Napping" },
  { category: "Activity", topic: "Origami" }, { category: "Activity", topic: "Painting" },
  { category: "Activity", topic: "Quilting" }, { category: "Activity", topic: "Running" },
  { category: "Activity", topic: "Singing" }, { category: "Activity", topic: "Tattooing" },
  { category: "Activity", topic: "Unicycling" }, { category: "Activity", topic: "Video Gaming" },
  { category: "Activity", topic: "Weightlifting" }, { category: "Activity", topic: "Xylophone Playing" },
  { category: "Activity", topic: "Yodeling" }, { category: "Activity", topic: "Ziplining" },
  { category: "Activity", topic: "Archery" }, { category: "Activity", topic: "Bowling" },
  { category: "Activity", topic: "Cycling" }, { category: "Activity", topic: "Driving" },
  { category: "Activity", topic: "Fencing" }, { category: "Activity", topic: "Gymnastics" },
  { category: "Activity", topic: "Hunting" }, { category: "Activity", topic: "Ironing" },
  { category: "Activity", topic: "Jogging" }, { category: "Activity", topic: "Karate" },
  { category: "Activity", topic: "Listening to Music" }, { category: "Activity", topic: "Meditation" },
  { category: "Activity", topic: "Needlepoint" }, { category: "Activity", topic: "Photography" },
  { category: "Activity", topic: "Reading" },

  // OBJECTS (45)
  { category: "Object", topic: "Time Machine" }, { category: "Object", topic: "Telescope" },
  { category: "Object", topic: "Electric Guitar" }, { category: "Object", topic: "Anchor" },
  { category: "Object", topic: "Backpack" }, { category: "Object", topic: "Camera" },
  { category: "Object", topic: "Diamond" }, { category: "Object", topic: "Egg Timer" },
  { category: "Object", topic: "Flashlight" }, { category: "Object", topic: "Goggles" },
  { category: "Object", topic: "Helmet" }, { category: "Object", topic: "Ink Pen" },
  { category: "Object", topic: "Joystick" }, { category: "Object", topic: "Keyboard" },
  { category: "Object", topic: "Lantern" }, { category: "Object", topic: "Microscope" },
  { category: "Object", topic: "Necklace" }, { category: "Object", topic: "Oven" },
  { category: "Object", topic: "Piano" }, { category: "Object", topic: "Quilt" },
  { category: "Object", topic: "Remote Control" }, { category: "Object", topic: "Stethoscope" },
  { category: "Object", topic: "Toaster" }, { category: "Object", topic: "Umbrella" },
  { category: "Object", topic: "Violin" }, { category: "Object", topic: "Watch" },
  { category: "Object", topic: "X-Ray Machine" }, { category: "Object", topic: "Yo-yo" },
  { category: "Object", topic: "Zipper" }, { category: "Object", topic: "Axe" },
  { category: "Object", topic: "Binoculars" }, { category: "Object", topic: "Compass" },
  { category: "Object", topic: "Drone" }, { category: "Object", topic: "Eraser" },
  { category: "Object", topic: "Fridge" }, { category: "Object", topic: "Globe" },
  { category: "Object", topic: "Hammer" }, { category: "Object", topic: "Idol" },
  { category: "Object", topic: "Jukebox" }, { category: "Object", topic: "Kettle" },
  { category: "Object", topic: "Ladder" }, { category: "Object", topic: "Magnet" },
  { category: "Object", topic: "Notebook" }, { category: "Object", topic: "Oil Lamp" },
  { category: "Object", topic: "Projector" },

  // ANIMALS (40)
  { category: "Animal", topic: "Platypus" }, { category: "Animal", topic: "Kangaroo" },
  { category: "Animal", topic: "Flamingo" }, { category: "Animal", topic: "Albatross" },
  { category: "Animal", topic: "Bee" }, { category: "Animal", topic: "Chameleon" },
  { category: "Animal", topic: "Dolphin" }, { category: "Animal", topic: "Elephant" },
  { category: "Animal", topic: "Frog" }, { category: "Animal", topic: "Giraffe" },
  { category: "Animal", topic: "Hippo" }, { category: "Animal", topic: "Iguana" },
  { category: "Animal", topic: "Jellyfish" }, { category: "Animal", topic: "Koala" },
  { category: "Animal", topic: "Lion" }, { category: "Animal", topic: "Monkey" },
  { category: "Animal", topic: "Newt" }, { category: "Animal", topic: "Octopus" },
  { category: "Animal", topic: "Penguin" }, { category: "Animal", topic: "Quokka" },
  { category: "Animal", topic: "Rabbit" }, { category: "Animal", topic: "Shark" },
  { category: "Animal", topic: "Tiger" }, { category: "Animal", topic: "Urchin" },
  { category: "Animal", topic: "Vulture" }, { category: "Animal", topic: "Whale" },
  { category: "Animal", topic: "X-ray Tetra" }, { category: "Animal", topic: "Yak" },
  { category: "Animal", topic: "Zebra" }, { category: "Animal", topic: "Alligator" },
  { category: "Animal", topic: "Bear" }, { category: "Animal", topic: "Cat" },
  { category: "Animal", topic: "Dog" }, { category: "Animal", topic: "Eagle" },
  { category: "Animal", topic: "Falcon" }, { category: "Animal", topic: "Gorilla" },
  { category: "Animal", topic: "Hamster" }, { category: "Animal", topic: "Insects" },
  { category: "Animal", topic: "Jaguar" }, { category: "Animal", topic: "Killer Whale" },

  // FOOD & DRINK (40)
  { category: "Food & Drink", topic: "Sushi" }, { category: "Food & Drink", topic: "Pizza" },
  { category: "Food & Drink", topic: "Burger" }, { category: "Food & Drink", topic: "Taco" },
  { category: "Food & Drink", topic: "Pasta" }, { category: "Food & Drink", topic: "Steak" },
  { category: "Food & Drink", topic: "Salad" }, { category: "Food & Drink", topic: "Soup" },
  { category: "Food & Drink", topic: "Sandwich" }, { category: "Food & Drink", topic: "Coffee" },
  { category: "Food & Drink", topic: "Tea" }, { category: "Food & Drink", topic: "Wine" },
  { category: "Food & Drink", topic: "Beer" }, { category: "Food & Drink", topic: "Milkshake" },
  { category: "Food & Drink", topic: "Smoothie" }, { category: "Food & Drink", topic: "Cake" },
  { category: "Food & Drink", topic: "Ice Cream" }, { category: "Food & Drink", topic: "Donut" },
  { category: "Food & Drink", topic: "Cookie" }, { category: "Food & Drink", topic: "Croissant" },
  { category: "Food & Drink", topic: "Baguette" }, { category: "Food & Drink", topic: "Chocolate" },
  { category: "Food & Drink", topic: "Popcorn" }, { category: "Food & Drink", topic: "Nacho" },
  { category: "Food & Drink", topic: "Fries" }, { category: "Food & Drink", topic: "Hot Dog" },
  { category: "Food & Drink", topic: "Burrito" }, { category: "Food & Drink", topic: "Ramen" },
  { category: "Food & Drink", topic: "Curry" }, { category: "Food & Drink", topic: "Lobster" },
  { category: "Food & Drink", topic: "Shrimp" }, { category: "Food & Drink", topic: "Pancake" },
  { category: "Food & Drink", topic: "Waffle" }, { category: "Food & Drink", topic: "Omelette" },
  { category: "Food & Drink", topic: "Cereal" }, { category: "Food & Drink", topic: "Yogurt" },
  { category: "Food & Drink", topic: "Cheese" }, { category: "Food & Drink", topic: "Apple" },
  { category: "Food & Drink", topic: "Banana" }, { category: "Food & Drink", topic: "Watermelon" },
];

const getLocalTopic = () => TOPIC_BANK[Math.floor(Math.random() * TOPIC_BANK.length)];

export const generateGameTopic = async (): Promise<TopicResponse> => {
  const apiKey = process.env.API_KEY;

  // If no API Key, immediately use local bank
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    return getLocalTopic();
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Generate a creative, common-knowledge topic for a social deduction game. It should be a specific place, object, profession, food, or activity. Ensure it is distinct and interesting.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description: "The general category",
            },
            topic: {
              type: Type.STRING,
              description: "The specific secret word",
            },
          },
          required: ["category", "topic"],
        },
      },
    });

    if (response.text) {
      try {
        return JSON.parse(response.text) as TopicResponse;
      } catch (e) {
        return getLocalTopic();
      }
    }
    return getLocalTopic();
  } catch (error) {
    console.error("Gemini API Error, using local fallback:", error);
    return getLocalTopic();
  }
};