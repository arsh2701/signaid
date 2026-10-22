/**
 * SignAid AI - Demo Data & Smart Keyword Definitions
 * Realistic lecture scripts, technical glossaries, and offline fallback datasets.
 */

const DEMO_LECTURES = {
  cs: {
    id: "cs",
    title: "Computer Science: Algorithm Complexity & Big-O Notation",
    speaker: "Prof. Ananya Sharma",
    subject: "Data Structures & Algorithms",
    chunks: [
      { text: "Good morning class! Today we are discussing algorithm efficiency and computational complexity.", delay: 2800 },
      { text: "When we write code, it is not enough for our program to just be correct; it must also run efficiently in terms of time complexity and space complexity.", delay: 3500 },
      { text: "Consider linear search versus binary search. If you have an unsorted list of one million items, linear search takes O(n) operations in the worst case.", delay: 3800 },
      { text: "That means if n is one million, you might inspect all one million elements before finding your target.", delay: 3200 },
      { text: "However, if the array is sorted, binary search can locate the element in logarithmic time, written as O(log n).", delay: 3600 },
      { text: "Log base 2 of one million is only approximately 20 comparisons! Think about that difference: twenty steps versus one million steps.", delay: 3800 },
      { text: "Now let's look at recursion. Recursion is when a function calls itself to solve smaller instances of the same problem.", delay: 3400, triggerSound: "Teacher taps whiteboard firmly" },
      { text: "In recursion, we must always have a base condition; otherwise, the execution causes a stack overflow error.", delay: 3300 },
      { text: "Common recursive algorithms include merge sort, quicksort, and depth-first search on graph data structures.", delay: 3500 },
      { text: "Keep in mind: Big-O notation describes the upper bound or worst-case performance of an algorithm as the input size grows towards infinity.", delay: 3800 },
      { text: "Are there any questions before we analyze dynamic programming and memoization?", delay: 3000 }
    ]
  },
  physics: {
    id: "physics",
    title: "Physics: Newton's Laws & Kinetic Energy",
    speaker: "Dr. Rajesh Verma",
    subject: "Classical Mechanics",
    chunks: [
      { text: "Welcome everyone. Today we are exploring Newton's three laws of motion and momentum conservation.", delay: 3000 },
      { text: "Newton's first law states that an object remains at rest or in uniform motion unless acted upon by an external net force.", delay: 3600 },
      { text: "This property of matter resisting changes in its velocity is known as inertia.", delay: 3100 },
      { text: "Newton's second law gives us the fundamental equation: Force equals mass multiplied by acceleration, F = m * a.", delay: 3500 },
      { text: "When force is applied over a distance, work is done, converting potential energy into kinetic energy.", delay: 3400, triggerSound: "Door closes in hallway" },
      { text: "Kinetic energy is calculated as one-half mass times velocity squared, showing how speed dramatically impacts energy.", delay: 3700 },
      { text: "Finally, the third law: For every action, there is an equal and opposite reaction.", delay: 3200 }
    ]
  },
  hindi_demo: {
    id: "hindi_demo",
    title: "Hindi/Hinglish Demo: प्रकाश संश्लेषण (Photosynthesis)",
    speaker: "प्रोफेसर वर्मा",
    subject: "जीव विज्ञान (Biology)",
    chunks: [
      { text: "नमस्ते विद्यार्थियों! आज हम पौधों में प्रकाश संश्लेषण की प्रक्रिया समझेंगे।", delay: 3200 },
      { text: "पौधे सूर्य के प्रकाश, कार्बन डाइऑक्साइड और जल का उपयोग करके ग्लूकोज और ऑक्सीजन का निर्माण करते हैं।", delay: 3800 },
      { text: "क्लोरोफिल पत्तियों में पाया जाने वाला हरा वर्णक है जो सौर ऊर्जा को रासायनिक ऊर्जा में बदलता है।", delay: 3600 },
      { text: "यह प्रक्रिया पृथ्वी पर जीवन के संतुलन के लिए अत्यंत आवश्यक है।", delay: 3000 }
    ]
  }
};

// Built-in glossary of technical terms with student-friendly definitions
const TECHNICAL_GLOSSARY = {
  "algorithm": {
    term: "Algorithm",
    category: "Computer Science",
    simple: "A step-by-step recipe or set of rules given to a computer to solve a specific problem.",
    example: "Like following a recipe to bake a cake step by step."
  },
  "complexity": {
    term: "Computational Complexity",
    category: "Computer Science",
    simple: "How much time or computer memory an algorithm needs as the problem size gets bigger.",
    example: "Sorting 10 cards takes seconds; sorting 10,000 cards needs a smart strategy."
  },
  "time complexity": {
    term: "Time Complexity",
    category: "Computer Science",
    simple: "The rate at which the run time of an algorithm grows as the input size increases.",
    example: "Checking every student one by one takes O(n) time."
  },
  "space complexity": {
    term: "Space Complexity",
    category: "Computer Science",
    simple: "The amount of extra working memory (RAM) an algorithm needs to execute.",
    example: "Writing calculations on scratch paper vs doing them in your head."
  },
  "linear search": {
    term: "Linear Search",
    category: "Algorithms",
    simple: "Checking every item in a list one by one from start to end until you find what you need.",
    example: "Looking through a shuffled deck of cards card-by-card."
  },
  "binary search": {
    term: "Binary Search",
    category: "Algorithms",
    simple: "A fast search technique on sorted items that cuts the search space in half each step.",
    example: "Opening a dictionary in the middle to find a word starting with 'M'."
  },
  "recursion": {
    term: "Recursion",
    category: "Programming",
    simple: "A programming method where a function solves a problem by calling a smaller version of itself.",
    example: "Russian nesting dolls, where each doll holds a smaller version inside until the tiny doll."
  },
  "stack overflow": {
    term: "Stack Overflow",
    category: "Computer Systems",
    simple: "An error that happens when a recursive function repeats forever without stopping, running out of call memory.",
    example: "Like stacking too many trays until the stack crashes onto the floor."
  },
  "base condition": {
    term: "Base Condition",
    category: "Programming",
    simple: "The stop rule in recursion that prevents the function from running forever.",
    example: "Telling an elevator to stop once it reaches the ground floor."
  },
  "big-o": {
    term: "Big-O Notation",
    category: "Mathematics / CS",
    simple: "A mathematical language used to describe the worst-case speed or limits of an algorithm.",
    example: "O(1) is instant like glancing at your watch; O(n) scales with the crowd size."
  },
  "dynamic programming": {
    term: "Dynamic Programming",
    category: "Algorithms",
    simple: "An optimization technique that breaks problems into sub-problems and remembers past answers.",
    example: "Writing down '1+1+1+1 = 4' so when someone adds '+1', you immediately know it's 5 without recounting."
  },
  "inertia": {
    term: "Inertia",
    category: "Physics",
    simple: "The natural resistance of an object to changing its speed or direction.",
    example: "When a bus stops suddenly and your body jerks forward."
  },
  "kinetic energy": {
    term: "Kinetic Energy",
    category: "Physics",
    simple: "The energy an object has because of its motion.",
    example: "A rolling bowling ball has kinetic energy that knocks over pins."
  },
  "momentum": {
    term: "Momentum",
    category: "Physics",
    simple: "Mass in motion: how hard it is to stop a moving object (Mass × Velocity).",
    example: "A loaded freight train moving slowly is much harder to stop than a bicycle."
  },
  "photosynthesis": {
    term: "Photosynthesis",
    category: "Biology",
    simple: "The process where green plants turn sunlight, water, and air into food and clean oxygen.",
    example: "Like solar-powered cooking inside plant leaves."
  },
  "chlorophyll": {
    term: "Chlorophyll",
    category: "Biology",
    simple: "The green chemical in plants that captures sunlight for photosynthesis.",
    example: "The solar panels of a plant leaf."
  }
};

// Fallback study kit generator data
const FALLBACK_STUDY_KITS = {
  cs: {
    summary: "Today's lecture covered algorithmic efficiency and performance scaling. The professor contrasted linear search O(n) against binary search O(log n), demonstrating how logarithmic algorithms scale gracefully with massive datasets. The lecture introduced recursion, emphasizing the critical need for base conditions to prevent stack overflow errors, and defined Big-O notation as the mathematical framework for measuring worst-case complexity.",
    keyPoints: [
      "Efficiency is measured in Time Complexity (speed) and Space Complexity (RAM usage).",
      "Linear Search checks items one by one: O(n) worst-case time.",
      "Binary Search divides sorted datasets in halves: O(log n) time (only 20 steps for 1 million items!).",
      "Recursion requires a valid Base Condition to terminate safely.",
      "Big-O notation describes the upper bound behavior as input size grows to infinity."
    ],
    flashcards: [
      { q: "What is Big-O Notation?", a: "A mathematical notation used to classify algorithms according to how their run time or space requirements grow as the input size grows." },
      { q: "What is the worst-case time complexity of Binary Search?", a: "O(log n) — logarithmic time, provided the input array is already sorted." },
      { q: "Why is a base condition necessary in recursion?", a: "To stop recursive calls once the smallest sub-problem is reached and prevent stack overflow errors." },
      { q: "What is the difference between Linear and Binary Search for 1,000,000 items?", a: "Linear search may take up to 1,000,000 comparisons, while Binary Search takes at most 20 comparisons." }
    ],
    quiz: [
      {
        question: "What is the worst-case time complexity of binary search on a sorted array of size n?",
        options: ["O(1)", "O(log n)", "O(n)", "O(n^2)"],
        answerIndex: 1,
        explanation: "Binary search cuts the search space in half at each step, resulting in logarithmic O(log n) time."
      },
      {
        question: "What happens if a recursive function lacks a base condition?",
        options: ["The function runs faster", "Stack overflow runtime error", "Memory is automatically freed", "The compiler fixes it"],
        answerIndex: 1,
        explanation: "Without a base condition, the call stack grows infinitely until memory is exhausted (Stack Overflow)."
      },
      {
        question: "How many steps does binary search take at most for 1,000,000 sorted elements?",
        options: ["100 steps", "Approximately 20 steps", "1,000 steps", "500,000 steps"],
        answerIndex: 1,
        explanation: "Since 2^20 is approximately 1,048,576, log2(1,000,000) is roughly 20 steps."
      },
      {
        question: "Which of the following describes Big-O notation accurately?",
        options: ["The exact milliseconds a CPU takes", "The best-case execution only", "The upper bound (worst-case) scaling behavior", "The line count of source code"],
        answerIndex: 2,
        explanation: "Big-O provides an asymptotic upper bound on growth rate as inputs become very large."
      },
      {
        question: "Which search algorithm checks elements sequentially from start to finish?",
        options: ["Binary Search", "Hash Lookup", "Linear Search", "Depth-First Search"],
        answerIndex: 2,
        explanation: "Linear search iterates through each item sequentially from index 0 to n-1."
      }
    ]
  }
};

window.DEMO_LECTURES = DEMO_LECTURES;
window.TECHNICAL_GLOSSARY = TECHNICAL_GLOSSARY;
window.FALLBACK_STUDY_KITS = FALLBACK_STUDY_KITS;
