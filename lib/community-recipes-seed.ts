import { type GeneratedRecipe } from "@/lib/types";

export interface SeedRecipe extends GeneratedRecipe {
  id: string;
  containsAllergens: string[]; // EU Big 14 codes present in this recipe
  tags: {
    cuisine: string;
    occasion?: string;
    mealType: string;
    dietaryPresets?: string[];
  };
}

// All seed recipes are free from all EU Big 14 allergens unless explicitly listed
// in containsAllergens. The 15 below contain none — they act as safe fallbacks
// for every guest user regardless of their allergen profile.
export const SEED_RECIPES: SeedRecipe[] = [
  // ── Global × 3 ─────────────────────────────────────────────────────────────

  {
    id: "seed-001",
    title: "Herb-Roasted Chicken Thighs with Lemon",
    description:
      "Golden, crispy-skinned chicken thighs roasted with garlic, rosemary, and lemon. A weeknight staple that tastes like you tried harder than you did.",
    cookTime: "50 minutes",
    servings: 4,
    allergenFree: true,
    containsAllergens: [],
    tags: { cuisine: "european", mealType: "main" },
    ingredients: [
      { name: "chicken thighs (bone-in, skin-on)", amount: 8, unit: "pieces" },
      { name: "olive oil", amount: 3, unit: "tbsp" },
      { name: "garlic", amount: 6, unit: "cloves" },
      { name: "rosemary", amount: 4, unit: "sprigs" },
      { name: "thyme", amount: 4, unit: "sprigs" },
      { name: "lemon", amount: 1, unit: "pieces" },
      { name: "cherry tomatoes", amount: 250, unit: "grams" },
      { name: "salt", amount: 1, unit: "tsp" },
      { name: "black pepper", amount: "½", unit: "tsp" },
    ],
    steps: [
      "Preheat oven to 200°C (180°C fan). Pat chicken dry with kitchen paper.",
      "Rub the thighs all over with olive oil, salt, and pepper. Lay skin-side up in a large roasting tray.",
      "Scatter garlic cloves (unpeeled), rosemary, and thyme around the chicken. Add cherry tomatoes to the tray.",
      "Squeeze the lemon over everything, then add the squeezed halves to the tray.",
      "Roast for 40–45 minutes until the skin is deep golden and the juices run clear when the thickest part is pierced.",
      "Rest for 5 minutes before serving. Spoon the tray juices over the top.",
    ],
  },

  {
    id: "seed-002",
    title: "Moroccan Chickpea and Spinach Stew",
    description:
      "A warming, fragrant stew built on chickpeas, canned tomatoes, and a blend of North African spices. Hearty enough for dinner, ready in 30 minutes.",
    cookTime: "30 minutes",
    servings: 4,
    allergenFree: true,
    containsAllergens: [],
    tags: { cuisine: "moroccan", mealType: "main", dietaryPresets: ["vegan", "vegetarian"] },
    ingredients: [
      { name: "chickpeas (canned, drained)", amount: 800, unit: "grams" },
      { name: "canned chopped tomatoes", amount: 400, unit: "grams" },
      { name: "baby spinach", amount: 150, unit: "grams" },
      { name: "onion", amount: 1, unit: "pieces" },
      { name: "garlic", amount: 4, unit: "cloves" },
      { name: "olive oil", amount: 2, unit: "tbsp" },
      { name: "vegetable stock", amount: 300, unit: "ml" },
      { name: "ground cumin", amount: 2, unit: "tsp" },
      { name: "ground coriander", amount: 1, unit: "tsp" },
      { name: "smoked paprika", amount: 1, unit: "tsp" },
      { name: "ground cinnamon", amount: "½", unit: "tsp" },
      { name: "ground turmeric", amount: "½", unit: "tsp" },
      { name: "fresh coriander", amount: 1, unit: "pieces" },
    ],
    steps: [
      "Dice the onion. Mince the garlic. Finely chop the fresh coriander.",
      "Heat olive oil in a large saucepan over medium heat. Sauté onion for 5–6 minutes until soft.",
      "Add garlic and all the spices. Stir for 1 minute until fragrant.",
      "Add chickpeas, canned tomatoes, and vegetable stock. Stir well and bring to a simmer.",
      "Cook uncovered for 15 minutes, stirring occasionally, until the sauce thickens slightly.",
      "Stir in the spinach in handfuls and cook for 2 minutes until wilted.",
      "Season to taste and scatter fresh coriander over the top before serving with warm flatbread or rice.",
    ],
  },

  {
    id: "seed-003",
    title: "Piri Piri Chicken with Sweet Potato",
    description:
      "Bold, fiery, and deeply satisfying. Chicken drumsticks marinated in homemade piri piri sauce, roasted alongside wedges of sweet potato.",
    cookTime: "55 minutes",
    servings: 4,
    allergenFree: true,
    containsAllergens: [],
    tags: { cuisine: "portuguese", mealType: "main" },
    ingredients: [
      { name: "chicken drumsticks", amount: 8, unit: "pieces" },
      { name: "sweet potato", amount: 600, unit: "grams" },
      { name: "olive oil", amount: 4, unit: "tbsp" },
      { name: "garlic", amount: 4, unit: "cloves" },
      { name: "lemon", amount: 1, unit: "pieces" },
      { name: "red chilli", amount: 2, unit: "pieces" },
      { name: "smoked paprika", amount: 2, unit: "tsp" },
      { name: "dried oregano", amount: 1, unit: "tsp" },
      { name: "ground cumin", amount: "½", unit: "tsp" },
      { name: "salt", amount: 1, unit: "tsp" },
    ],
    steps: [
      "Blend garlic, red chillies, lemon juice, smoked paprika, oregano, cumin, 2 tbsp olive oil, and salt into a rough paste.",
      "Score the chicken drumsticks and coat thoroughly in the marinade. Marinate for at least 20 minutes (longer if time allows).",
      "Preheat oven to 200°C. Cut sweet potatoes into wedges and toss with remaining olive oil and a pinch of salt.",
      "Arrange sweet potato wedges and chicken in a single layer on a large roasting tray.",
      "Roast for 40–45 minutes, turning the sweet potato wedges halfway, until chicken is cooked through and charred at the edges.",
      "Rest for 5 minutes and serve with the tray juices spooned over.",
    ],
  },

  // ── Gluten-free × 2 ─────────────────────────────────────────────────────────

  {
    id: "seed-004",
    title: "Greek-Inspired Lemon Oregano Chicken",
    description:
      "Chicken thighs roasted in a pool of lemon, oregano, and garlic with new potatoes and olives. Effortless, fragrant, and totally reliable.",
    cookTime: "55 minutes",
    servings: 4,
    allergenFree: true,
    containsAllergens: [],
    tags: { cuisine: "greek", mealType: "main" },
    ingredients: [
      { name: "chicken thighs", amount: 8, unit: "pieces" },
      { name: "new potatoes", amount: 500, unit: "grams" },
      { name: "lemon", amount: 2, unit: "pieces" },
      { name: "garlic", amount: 6, unit: "cloves" },
      { name: "olive oil", amount: 4, unit: "tbsp" },
      { name: "dried oregano", amount: 2, unit: "tsp" },
      { name: "black olives", amount: 80, unit: "grams" },
      { name: "cherry tomatoes", amount: 200, unit: "grams" },
      { name: "fresh parsley", amount: 1, unit: "pieces" },
    ],
    steps: [
      "Preheat oven to 200°C. Halve new potatoes. Smash garlic cloves.",
      "Mix olive oil, lemon juice, dried oregano, and garlic in a large roasting tin.",
      "Add potatoes and toss to coat. Make space for the chicken thighs and nestle them in skin-side up.",
      "Roast for 30 minutes. Add cherry tomatoes and olives, then roast for a further 15–20 minutes until chicken is golden and potatoes are tender.",
      "Scatter fresh parsley and lemon zest over before serving.",
    ],
  },

  {
    id: "seed-005",
    title: "Spiced Beef and Potato Curry",
    description:
      "A slow-simmered curry with tender chunks of beef, potatoes, and warming spices. The kind of dish that fills the kitchen with good smells for an hour.",
    cookTime: "1 hour 20 minutes",
    servings: 4,
    allergenFree: true,
    containsAllergens: [],
    tags: { cuisine: "indian", mealType: "main" },
    ingredients: [
      { name: "beef (stewing cuts, cubed)", amount: 700, unit: "grams" },
      { name: "potatoes", amount: 400, unit: "grams" },
      { name: "canned chopped tomatoes", amount: 400, unit: "grams" },
      { name: "onion", amount: 2, unit: "pieces" },
      { name: "garlic", amount: 5, unit: "cloves" },
      { name: "fresh ginger", amount: 30, unit: "grams" },
      { name: "vegetable oil", amount: 3, unit: "tbsp" },
      { name: "ground cumin", amount: 2, unit: "tsp" },
      { name: "ground coriander", amount: 2, unit: "tsp" },
      { name: "ground turmeric", amount: 1, unit: "tsp" },
      { name: "garam masala", amount: 1, unit: "tsp" },
      { name: "fresh coriander", amount: 1, unit: "pieces" },
      { name: "basmati rice", amount: 300, unit: "grams" },
    ],
    steps: [
      "Dice onion. Mince garlic and ginger. Peel and cube potatoes.",
      "Heat oil in a heavy-bottomed pot over medium-high heat. Brown beef in batches and set aside.",
      "In the same pot, fry onion for 7 minutes until golden. Add garlic and ginger, cook 2 minutes.",
      "Add cumin, coriander, and turmeric. Stir for 1 minute.",
      "Return beef to pot with canned tomatoes and 300ml water. Bring to a boil, then reduce heat and simmer covered for 45 minutes.",
      "Add potatoes and cook uncovered for a further 20 minutes until tender and sauce thickens.",
      "Stir in garam masala. Serve over basmati rice with fresh coriander scattered on top.",
    ],
  },

  // ── Dairy-free × 2 ──────────────────────────────────────────────────────────

  {
    id: "seed-006",
    title: "Coconut Red Lentil Dal",
    description:
      "A silky, golden dal made with red lentils and coconut milk. Nourishing, quick, and deeply satisfying — finished with a fragrant tarka.",
    cookTime: "30 minutes",
    servings: 4,
    allergenFree: true,
    containsAllergens: [],
    tags: { cuisine: "indian", mealType: "main", dietaryPresets: ["vegan", "vegetarian"] },
    ingredients: [
      { name: "red lentils", amount: 300, unit: "grams" },
      { name: "coconut milk", amount: 400, unit: "ml" },
      { name: "canned chopped tomatoes", amount: 400, unit: "grams" },
      { name: "onion", amount: 1, unit: "pieces" },
      { name: "garlic", amount: 4, unit: "cloves" },
      { name: "fresh ginger", amount: 20, unit: "grams" },
      { name: "vegetable oil", amount: 2, unit: "tbsp" },
      { name: "ground cumin", amount: 1, unit: "tsp" },
      { name: "ground coriander", amount: 1, unit: "tsp" },
      { name: "ground turmeric", amount: "½", unit: "tsp" },
      { name: "garam masala", amount: "½", unit: "tsp" },
      { name: "fresh coriander", amount: 1, unit: "pieces" },
      { name: "basmati rice", amount: 300, unit: "grams" },
    ],
    steps: [
      "Rinse lentils until the water runs clear. Finely dice onion. Mince garlic and ginger.",
      "Sauté onion in oil over medium heat for 6 minutes until soft. Add garlic, ginger, cumin, coriander, and turmeric. Stir for 2 minutes.",
      "Add lentils, canned tomatoes, coconut milk, and 300ml water. Stir well.",
      "Simmer uncovered for 20 minutes, stirring occasionally, until lentils are completely soft and dal is thick.",
      "Stir in garam masala. Season with salt. Cook rice according to packet instructions.",
      "Serve dal over rice with fresh coriander. A squeeze of lime is welcome.",
    ],
  },

  {
    id: "seed-007",
    title: "Thai-Inspired Coconut Chicken Soup",
    description:
      "A fragrant coconut broth with tender chicken, lemongrass, and ginger. This allergen-free version skips fish sauce without losing any of the depth.",
    cookTime: "25 minutes",
    servings: 4,
    allergenFree: true,
    containsAllergens: [],
    tags: { cuisine: "thai", mealType: "main" },
    ingredients: [
      { name: "chicken breast", amount: 600, unit: "grams" },
      { name: "coconut milk", amount: 800, unit: "ml" },
      { name: "chicken stock", amount: 400, unit: "ml" },
      { name: "lemongrass stalks", amount: 2, unit: "pieces" },
      { name: "fresh ginger", amount: 30, unit: "grams" },
      { name: "red chilli", amount: 1, unit: "pieces" },
      { name: "lime", amount: 2, unit: "pieces" },
      { name: "spring onion", amount: 4, unit: "pieces" },
      { name: "fresh coriander", amount: 1, unit: "pieces" },
      { name: "rice noodles", amount: 200, unit: "grams" },
      { name: "baby spinach", amount: 100, unit: "grams" },
    ],
    steps: [
      "Slice chicken breast into thin strips. Bruise lemongrass stalks. Slice ginger into coins. Slice chilli.",
      "Bring coconut milk and chicken stock to a gentle simmer with lemongrass, ginger, and chilli.",
      "Add chicken strips and simmer for 8–10 minutes until cooked through.",
      "Meanwhile, cook rice noodles in a separate pan according to packet instructions.",
      "Add spinach to the soup and stir until wilted. Squeeze in lime juice.",
      "Divide noodles between bowls, ladle soup over, and top with sliced spring onion and fresh coriander.",
    ],
  },

  // ── Nut-free × 2 (explicitly designed without any tree nuts or peanuts) ─────

  {
    id: "seed-008",
    title: "Slow-Roasted Lamb Shoulder with Herbs",
    description:
      "Fall-apart lamb shoulder perfumed with rosemary and garlic, roasted low and slow until the meat melts from the bone. Worth every minute.",
    cookTime: "3 hours 30 minutes",
    servings: 6,
    allergenFree: true,
    containsAllergens: [],
    tags: { cuisine: "european", mealType: "main" },
    ingredients: [
      { name: "lamb shoulder (bone-in)", amount: 2, unit: "kg" },
      { name: "garlic", amount: 8, unit: "cloves" },
      { name: "rosemary", amount: 6, unit: "sprigs" },
      { name: "thyme", amount: 4, unit: "sprigs" },
      { name: "olive oil", amount: 3, unit: "tbsp" },
      { name: "onion", amount: 2, unit: "pieces" },
      { name: "baby potatoes", amount: 600, unit: "grams" },
      { name: "chicken stock", amount: 200, unit: "ml" },
      { name: "salt", amount: "1½", unit: "tsp" },
      { name: "black pepper", amount: 1, unit: "tsp" },
    ],
    steps: [
      "Preheat oven to 160°C. Using a small knife, make deep slits all over the lamb shoulder.",
      "Stuff slivers of garlic and small sprigs of rosemary into the slits. Rub all over with olive oil, salt, and pepper.",
      "Quarter the onions and scatter in a deep roasting tin with the potatoes. Pour in stock.",
      "Place lamb on top. Cover tightly with foil and roast for 3 hours.",
      "Remove foil and increase oven to 200°C. Roast for a further 20–30 minutes until the outside is caramelised.",
      "Rest covered for 20 minutes. Pull the meat apart with two forks and serve with the roasting juices.",
    ],
  },

  {
    id: "seed-009",
    title: "Black Bean and Sweet Potato Bowl",
    description:
      "A vibrant, filling bowl with spiced black beans, roasted sweet potato, and avocado. Nourishing food that doesn't feel like a compromise.",
    cookTime: "40 minutes",
    servings: 4,
    allergenFree: true,
    containsAllergens: [],
    tags: { cuisine: "mexican", mealType: "main", dietaryPresets: ["vegan", "vegetarian"] },
    ingredients: [
      { name: "black beans (canned, drained)", amount: 800, unit: "grams" },
      { name: "sweet potato", amount: 600, unit: "grams" },
      { name: "long grain rice", amount: 300, unit: "grams" },
      { name: "avocado", amount: 2, unit: "pieces" },
      { name: "red pepper", amount: 2, unit: "pieces" },
      { name: "red onion", amount: 1, unit: "pieces" },
      { name: "olive oil", amount: 3, unit: "tbsp" },
      { name: "ground cumin", amount: 2, unit: "tsp" },
      { name: "smoked paprika", amount: 1, unit: "tsp" },
      { name: "lime", amount: 2, unit: "pieces" },
      { name: "fresh coriander", amount: 1, unit: "pieces" },
    ],
    steps: [
      "Preheat oven to 200°C. Peel and cube sweet potato. Dice red pepper. Halve and slice red onion.",
      "Toss sweet potato and pepper with 2 tbsp olive oil, cumin, and paprika. Spread on a baking tray and roast for 25–30 minutes until tender.",
      "Cook rice according to packet instructions.",
      "Warm black beans in a pan with 1 tbsp olive oil, a squeeze of lime, and a pinch of cumin.",
      "Slice avocado. Chop fresh coriander.",
      "Assemble bowls: rice first, then black beans, roasted vegetables, and avocado. Finish with lime juice and coriander.",
    ],
  },

  // ── Vegan × 2 ────────────────────────────────────────────────────────────────

  {
    id: "seed-010",
    title: "Harissa Roasted Cauliflower with Chickpeas",
    description:
      "Whole roasted cauliflower florets and chickpeas coated in harissa paste, emerging from the oven caramelised and punchy. Serve with fluffy rice.",
    cookTime: "40 minutes",
    servings: 4,
    allergenFree: true,
    containsAllergens: [],
    tags: { cuisine: "north_african", mealType: "main", dietaryPresets: ["vegan", "vegetarian"] },
    ingredients: [
      { name: "cauliflower", amount: 1, unit: "pieces" },
      { name: "chickpeas (canned, drained)", amount: 400, unit: "grams" },
      { name: "harissa paste", amount: 3, unit: "tbsp" },
      { name: "olive oil", amount: 3, unit: "tbsp" },
      { name: "lemon", amount: 1, unit: "pieces" },
      { name: "garlic", amount: 2, unit: "cloves" },
      { name: "fresh parsley", amount: 1, unit: "pieces" },
      { name: "ground cumin", amount: 1, unit: "tsp" },
      { name: "basmati rice", amount: 300, unit: "grams" },
    ],
    steps: [
      "Preheat oven to 200°C. Cut cauliflower into large florets. Pat chickpeas dry.",
      "Whisk harissa, olive oil, and minced garlic together. Toss cauliflower and chickpeas thoroughly in this mixture.",
      "Spread in a single layer on a large baking tray. Roast for 30–35 minutes, tossing once halfway, until edges are charred.",
      "Cook rice according to packet instructions.",
      "Squeeze lemon juice over the cauliflower when it comes out of the oven. Scatter fresh parsley on top.",
      "Serve alongside rice, with extra harissa on the side.",
    ],
  },

  {
    id: "seed-011",
    title: "Cuban-Style Black Beans with Rice",
    description:
      "Slowly simmered black beans with cumin, oregano, and bay leaves. Simple but never boring — one of those dishes that tastes better every day.",
    cookTime: "35 minutes",
    servings: 4,
    allergenFree: true,
    containsAllergens: [],
    tags: { cuisine: "caribbean", mealType: "main", dietaryPresets: ["vegan", "vegetarian"] },
    ingredients: [
      { name: "black beans (canned, drained)", amount: 800, unit: "grams" },
      { name: "long grain rice", amount: 300, unit: "grams" },
      { name: "onion", amount: 1, unit: "pieces" },
      { name: "garlic", amount: 4, unit: "cloves" },
      { name: "red pepper", amount: 1, unit: "pieces" },
      { name: "olive oil", amount: 2, unit: "tbsp" },
      { name: "vegetable stock", amount: 300, unit: "ml" },
      { name: "ground cumin", amount: 2, unit: "tsp" },
      { name: "dried oregano", amount: 1, unit: "tsp" },
      { name: "bay leaves", amount: 2, unit: "pieces" },
      { name: "lime", amount: 1, unit: "pieces" },
    ],
    steps: [
      "Dice onion and red pepper. Mince garlic.",
      "Heat olive oil in a wide saucepan over medium heat. Sauté onion and pepper for 6 minutes.",
      "Add garlic, cumin, and oregano. Stir for 1 minute.",
      "Add beans, stock, and bay leaves. Bring to a simmer and cook uncovered for 20 minutes until thick and saucy.",
      "Cook rice according to packet instructions. Remove bay leaves from beans.",
      "Season beans with lime juice and salt. Serve alongside or mixed into the rice.",
    ],
  },

  // ── Low-FODMAP × 2 (no garlic bulb/onion bulb — garlic-infused oil only) ────

  {
    id: "seed-012",
    title: "Low-FODMAP Herb Chicken with Green Beans",
    description:
      "Tender chicken breasts cooked in garlic-infused oil with fresh herbs and lemon, served with green beans and new potatoes. Clean, bright, and kind to your gut.",
    cookTime: "35 minutes",
    servings: 2,
    allergenFree: true,
    containsAllergens: [],
    tags: { cuisine: "european", mealType: "main", dietaryPresets: ["low_fodmap"] },
    ingredients: [
      { name: "chicken breast", amount: 2, unit: "pieces" },
      { name: "garlic-infused olive oil", amount: 3, unit: "tbsp" },
      { name: "new potatoes", amount: 300, unit: "grams" },
      { name: "green beans", amount: 200, unit: "grams" },
      { name: "lemon", amount: 1, unit: "pieces" },
      { name: "fresh parsley", amount: 1, unit: "pieces" },
      { name: "fresh chives", amount: 1, unit: "pieces" },
      { name: "dried thyme", amount: 1, unit: "tsp" },
      { name: "salt", amount: "½", unit: "tsp" },
      { name: "black pepper", amount: "¼", unit: "tsp" },
    ],
    steps: [
      "Halve new potatoes. Boil in salted water for 15 minutes until tender, adding green beans for the final 4 minutes.",
      "While potatoes cook, flatten chicken breasts to even thickness. Season with thyme, salt, and pepper.",
      "Heat garlic-infused olive oil in a frying pan over medium-high heat. Cook chicken for 5–6 minutes per side until golden and cooked through.",
      "Drain potatoes and green beans. Toss with 1 tbsp garlic-infused oil and a squeeze of lemon.",
      "Slice chicken. Serve over potatoes and beans with fresh parsley and chives.",
    ],
  },

  {
    id: "seed-013",
    title: "Low-FODMAP Lemon Herb Roasted Chicken Legs",
    description:
      "Chicken legs roasted to crispy perfection with a lemon and herb coating. No garlic bulb, no onion — just bright, clean flavour that won't cause a flare.",
    cookTime: "50 minutes",
    servings: 4,
    allergenFree: true,
    containsAllergens: [],
    tags: { cuisine: "european", mealType: "main", dietaryPresets: ["low_fodmap"] },
    ingredients: [
      { name: "chicken legs", amount: 4, unit: "pieces" },
      { name: "garlic-infused olive oil", amount: 4, unit: "tbsp" },
      { name: "lemon", amount: 2, unit: "pieces" },
      { name: "fresh rosemary", amount: 3, unit: "sprigs" },
      { name: "fresh thyme", amount: 3, unit: "sprigs" },
      { name: "carrots", amount: 3, unit: "pieces" },
      { name: "parsnips", amount: 2, unit: "pieces" },
      { name: "courgette", amount: 2, unit: "pieces" },
      { name: "salt", amount: 1, unit: "tsp" },
    ],
    steps: [
      "Preheat oven to 200°C. Peel and chunk carrots and parsnips. Slice courgette into rounds.",
      "Toss vegetables with 2 tbsp garlic-infused oil, salt, and pepper. Spread in a roasting tray.",
      "Mix remaining oil with lemon zest, lemon juice, chopped rosemary, and thyme.",
      "Score chicken legs and coat with the herb oil mixture. Place on top of vegetables.",
      "Roast for 40–45 minutes until the skin is golden and vegetables are caramelised.",
      "Rest for 5 minutes. Serve from the tray.",
    ],
  },

  // ── No restrictions, various cuisines × 2 ────────────────────────────────────

  {
    id: "seed-014",
    title: "Roasted Vegetable Quinoa Bowl with Tahini Lemon Drizzle",
    description:
      "Colourful roasted vegetables piled onto nutty quinoa, finished with a tahini-lemon drizzle. Light enough to feel virtuous, substantial enough to actually satisfy.",
    cookTime: "35 minutes",
    servings: 4,
    allergenFree: true,
    containsAllergens: [],
    tags: { cuisine: "mediterranean", mealType: "main", dietaryPresets: ["vegan", "vegetarian"] },
    ingredients: [
      { name: "quinoa", amount: 300, unit: "grams" },
      { name: "courgette", amount: 2, unit: "pieces" },
      { name: "red pepper", amount: 2, unit: "pieces" },
      { name: "red onion", amount: 1, unit: "pieces" },
      { name: "cherry tomatoes", amount: 250, unit: "grams" },
      { name: "olive oil", amount: 3, unit: "tbsp" },
      { name: "lemon", amount: 2, unit: "pieces" },
      { name: "garlic", amount: 2, unit: "cloves" },
      { name: "fresh parsley", amount: 1, unit: "pieces" },
      { name: "ground cumin", amount: 1, unit: "tsp" },
    ],
    steps: [
      "Preheat oven to 200°C. Chop courgette and pepper into chunks. Halve red onion into wedges.",
      "Toss vegetables with olive oil, cumin, minced garlic, salt, and pepper. Roast for 25–30 minutes until caramelised. Add cherry tomatoes for the final 10 minutes.",
      "Cook quinoa: rinse, then simmer in 600ml water for 12 minutes. Fluff with a fork.",
      "Mix together 1 tbsp olive oil and the juice and zest of one lemon as a simple drizzle.",
      "Arrange quinoa in bowls, pile roasted vegetables on top, drizzle with the lemon oil.",
      "Finish with chopped parsley and extra lemon.",
    ],
  },

  {
    id: "seed-015",
    title: "Slow-Cooked Beef Ragu with Polenta",
    description:
      "A rich, slow-cooked beef ragu with tomatoes and herbs, served over creamy polenta. Deep winter comfort food that takes 15 minutes of actual work.",
    cookTime: "2 hours 20 minutes",
    servings: 6,
    allergenFree: true,
    containsAllergens: [],
    tags: { cuisine: "italian", mealType: "main" },
    ingredients: [
      { name: "beef (shin or cheek, cubed)", amount: 1, unit: "kg" },
      { name: "canned chopped tomatoes", amount: 800, unit: "grams" },
      { name: "onion", amount: 2, unit: "pieces" },
      { name: "carrot", amount: 2, unit: "pieces" },
      { name: "garlic", amount: 5, unit: "cloves" },
      { name: "olive oil", amount: 3, unit: "tbsp" },
      { name: "vegetable stock", amount: 400, unit: "ml" },
      { name: "tomato paste", amount: 2, unit: "tbsp" },
      { name: "dried bay leaves", amount: 2, unit: "pieces" },
      { name: "dried thyme", amount: 1, unit: "tsp" },
      { name: "polenta", amount: 250, unit: "grams" },
      { name: "fresh basil", amount: 1, unit: "pieces" },
    ],
    steps: [
      "Dice onion, carrot, and garlic. Season beef generously with salt and pepper.",
      "Heat olive oil in a heavy-bottomed pot over high heat. Brown beef in batches until well-coloured on all sides. Set aside.",
      "Reduce heat to medium. Fry onion and carrot for 6 minutes. Add garlic and tomato paste, stir for 2 minutes.",
      "Return beef. Add tomatoes, stock, bay leaves, and thyme. Bring to a simmer.",
      "Cover and cook on lowest heat for 1 hour 45 minutes until beef is tender enough to shred easily.",
      "Shred beef in the pot. Cook polenta in a separate pan according to packet instructions with plenty of water and salt.",
      "Serve ragu over polenta with fresh basil.",
    ],
  },
];
