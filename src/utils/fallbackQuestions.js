// src/utils/fallbackQuestions.js
// Comprehensive fallback questions pool with 100+ questions

const FALLBACK_QUESTIONS = {
    Easy: [
        // One Piece - Easy
        {
            question: "Who is the main protagonist of One Piece?",
            options: ["Monkey D. Luffy", "Roronoa Zoro", "Nami", "Sanji"],
            answer: "Monkey D. Luffy",
            difficulty: "Easy"
        },
        {
            question: "What is Luffy's Devil Fruit power?",
            options: ["Rubber abilities", "Fire powers", "Ice powers", "Lightning powers"],
            answer: "Rubber abilities",
            difficulty: "Easy"
        },
        {
            question: "What is the name of Luffy's pirate crew?",
            options: ["Straw Hat Pirates", "Red Hair Pirates", "Whitebeard Pirates", "Heart Pirates"],
            answer: "Straw Hat Pirates",
            difficulty: "Easy"
        },
        {
            question: "What is Nico Robin's Devil Fruit power called?",
            options: ["Hana Hana no Mi", "Gomu Gomu no Mi", "Mera Mera no Mi", "Hito Hito no Mi"],
            answer: "Hana Hana no Mi",
            difficulty: "Easy"
        },
        {
            question: "What is the currency used in the One Piece world?",
            options: ["Belly", "Zeni", "Jenny", "Gold"],
            answer: "Belly",
            difficulty: "Easy"
        },
        {
            question: "What type of animal is Tony Tony Chopper?",
            options: ["Reindeer", "Deer", "Moose", "Elk"],
            answer: "Reindeer",
            difficulty: "Easy"
        },

        // Naruto - Easy
        {
            question: "What village is Naruto from?",
            options: ["Hidden Leaf Village", "Hidden Sand Village", "Hidden Mist Village", "Hidden Cloud Village"],
            answer: "Hidden Leaf Village",
            difficulty: "Easy"
        },
        {
            question: "What color is Naruto's signature jumpsuit?",
            options: ["Orange", "Blue", "Red", "Yellow"],
            answer: "Orange",
            difficulty: "Easy"
        },
        {
            question: "What is Sasuke's clan name?",
            options: ["Uchiha", "Uzumaki", "Hyuga", "Nara"],
            answer: "Uchiha",
            difficulty: "Easy"
        },
        {
            question: "What is Sakura's hair color?",
            options: ["Pink", "Blonde", "Black", "Red"],
            answer: "Pink",
            difficulty: "Easy"
        },
        {
            question: "What color are Naruto's eyes?",
            options: ["Blue", "Brown", "Green", "Black"],
            answer: "Blue",
            difficulty: "Easy"
        },

        // Dragon Ball - Easy
        {
            question: "How many Dragon Balls are there?",
            options: ["7", "5", "9", "12"],
            answer: "7",
            difficulty: "Easy"
        },
        {
            question: "What is Goku's Saiyan name?",
            options: ["Kakarot", "Raditz", "Vegeta", "Nappa"],
            answer: "Kakarot",
            difficulty: "Easy"
        },
        {
            question: "What is Vegeta's signature attack?",
            options: ["Final Flash", "Kamehameha", "Special Beam Cannon", "Destructo Disk"],
            answer: "Final Flash",
            difficulty: "Easy"
        },

        // My Hero Academia - Easy
        {
            question: "What is Deku's real name?",
            options: ["Izuku Midoriya", "Katsuki Bakugo", "Shoto Todoroki", "Tenya Iida"],
            answer: "Izuku Midoriya",
            difficulty: "Easy"
        },
        {
            question: "What is All Might's real name?",
            options: ["Toshinori Yagi", "Izuku Midoriya", "Shota Aizawa", "Hizashi Yamada"],
            answer: "Toshinori Yagi",
            difficulty: "Easy"
        },
        {
            question: "What is Bakugo's hero name?",
            options: ["Dynamight", "Explosion", "Blast", "Boom"],
            answer: "Dynamight",
            difficulty: "Easy"
        },

        // Attack on Titan - Easy
        {
            question: "What is the main character's name in Attack on Titan?",
            options: ["Eren Yeager", "Mikasa Ackerman", "Armin Arlert", "Levi Ackerman"],
            answer: "Eren Yeager",
            difficulty: "Easy"
        },
        {
            question: "What are the giant humanoid creatures called in Attack on Titan?",
            options: ["Titans", "Giants", "Colossi", "Behemoths"],
            answer: "Titans",
            difficulty: "Easy"
        },
        {
            question: "What are the walls called in Attack on Titan?",
            options: ["Maria, Rose, and Sheena", "Alpha, Beta, and Gamma", "First, Second, and Third", "North, South, and Center"],
            answer: "Maria, Rose, and Sheena",
            difficulty: "Easy"
        },

        // Death Note - Easy
        {
            question: "What is the name of the notebook in Death Note?",
            options: ["Death Note", "Kill Book", "Death Journal", "Murder Diary"],
            answer: "Death Note",
            difficulty: "Easy"
        },
        {
            question: "What is Light's last name?",
            options: ["Yagami", "Kira", "Lawliet", "Amane"],
            answer: "Yagami",
            difficulty: "Easy"
        },

        // Demon Slayer - Easy
        {
            question: "What is Nezuko to Tanjiro?",
            options: ["Sister", "Friend", "Girlfriend", "Cousin"],
            answer: "Sister",
            difficulty: "Easy"
        },
        {
            question: "What is Tanjiro's main weapon?",
            options: ["Sword", "Bow", "Spear", "Axe"],
            answer: "Sword",
            difficulty: "Easy"
        },

        // Pokemon - Easy
        {
            question: "What type of Pokemon is Pikachu?",
            options: ["Electric", "Fire", "Water", "Grass"],
            answer: "Electric",
            difficulty: "Easy"
        },
        {
            question: "Who is Ash's first Pokemon?",
            options: ["Pikachu", "Charmander", "Squirtle", "Bulbasaur"],
            answer: "Pikachu",
            difficulty: "Easy"
        },
        {
            question: "What type is Charizard?",
            options: ["Fire/Flying", "Fire/Dragon", "Fire", "Dragon"],
            answer: "Fire/Flying",
            difficulty: "Easy"
        },

        // Other Popular Anime - Easy
        {
            question: "What does 'anime' literally mean in Japanese?",
            options: ["Animation", "Cartoon", "Drawing", "Story"],
            answer: "Animation",
            difficulty: "Easy"
        },
        {
            question: "In Sailor Moon, what is Usagi's superhero name?",
            options: ["Sailor Moon", "Sailor Mars", "Sailor Venus", "Sailor Jupiter"],
            answer: "Sailor Moon",
            difficulty: "Easy"
        },
        {
            question: "In One Punch Man, what is Saitama known for?",
            options: ["Defeating enemies in one punch", "Super speed", "Flight", "Telepathy"],
            answer: "Defeating enemies in one punch",
            difficulty: "Easy"
        },
        {
            question: "What is the main setting of Fairy Tail?",
            options: ["A wizard guild", "A ninja village", "A pirate ship", "A school"],
            answer: "A wizard guild",
            difficulty: "Easy"
        },
        {
            question: "In Bleach, what are soul reapers called in Japanese?",
            options: ["Shinigami", "Hollow", "Quincy", "Arrancar"],
            answer: "Shinigami",
            difficulty: "Easy"
        },
        {
            question: "What is the main character's power in Mob Psycho 100?",
            options: ["Psychic abilities", "Super strength", "Time manipulation", "Shape shifting"],
            answer: "Psychic abilities",
            difficulty: "Easy"
        },
    ],

    Medium: [
        // One Piece - Medium
        {
            question: "What is the name of Nico Robin's home island?",
            options: ["Ohara", "Alabasta", "Water 7", "Enies Lobby"],
            answer: "Ohara",
            difficulty: "Medium"
        },
        {
            question: "What is the name of the sea where most of One Piece takes place?",
            options: ["Grand Line", "East Blue", "West Blue", "Red Line"],
            answer: "Grand Line",
            difficulty: "Medium"
        },
        {
            question: "What is the name of Luffy's first crew member?",
            options: ["Roronoa Zoro", "Nami", "Usopp", "Sanji"],
            answer: "Roronoa Zoro",
            difficulty: "Medium"
        },
        {
            question: "What is the name of Sanji's fighting style?",
            options: ["Black Leg Style", "Red Leg Style", "Blue Leg Style", "Green Leg Style"],
            answer: "Black Leg Style",
            difficulty: "Medium"
        },
        {
            question: "What is Zoro's dream?",
            options: ["To become the world's greatest swordsman", "To find the One Piece", "To draw a map of the world", "To find the All Blue"],
            answer: "To become the world's greatest swordsman",
            difficulty: "Medium"
        },
        {
            question: "What is Brook's Devil Fruit power?",
            options: ["Revive-Revive Fruit", "Soul-Soul Fruit", "Bone-Bone Fruit", "Music-Music Fruit"],
            answer: "Revive-Revive Fruit",
            difficulty: "Medium"
        },
        {
            question: "What is the name of the cook on the Straw Hat crew?",
            options: ["Sanji", "Zoro", "Usopp", "Chopper"],
            answer: "Sanji",
            difficulty: "Medium"
        },

        // Naruto - Medium
        {
            question: "What is the name of Naruto's signature jutsu?",
            options: ["Shadow Clone Jutsu", "Rasengan", "Chidori", "Fireball Jutsu"],
            answer: "Shadow Clone Jutsu",
            difficulty: "Medium"
        },
        {
            question: "Who is Naruto's sensei in Team 7?",
            options: ["Kakashi Hatake", "Iruka Umino", "Asuma Sarutobi", "Might Guy"],
            answer: "Kakashi Hatake",
            difficulty: "Medium"
        },
        {
            question: "What is the name of the Nine-Tailed Fox?",
            options: ["Kurama", "Shukaku", "Matatabi", "Isobu"],
            answer: "Kurama",
            difficulty: "Medium"
        },
        {
            question: "In Naruto, what is the name of Kakashi's signature jutsu?",
            options: ["Chidori", "Rasengan", "Shadow Clone", "Fireball Jutsu"],
            answer: "Chidori",
            difficulty: "Medium"
        },
        {
            question: "What is the name of Sasuke's older brother?",
            options: ["Itachi Uchiha", "Madara Uchiha", "Shisui Uchiha", "Obito Uchiha"],
            answer: "Itachi Uchiha",
            difficulty: "Medium"
        },

        // Dragon Ball - Medium
        {
            question: "What is the name of Goku's signature technique?",
            options: ["Kamehameha", "Final Flash", "Special Beam Cannon", "Destructo Disk"],
            answer: "Kamehameha",
            difficulty: "Medium"
        },
        {
            question: "Who is Goku's eldest son?",
            options: ["Gohan", "Goten", "Trunks", "Vegeta"],
            answer: "Gohan",
            difficulty: "Medium"
        },
        {
            question: "What planet do Saiyans come from?",
            options: ["Planet Vegeta", "Planet Namek", "Planet Earth", "Planet Frieza"],
            answer: "Planet Vegeta",
            difficulty: "Medium"
        },

        // Attack on Titan - Medium
        {
            question: "In Attack on Titan, what is Eren's Titan form called?",
            options: ["Attack Titan", "Colossal Titan", "Female Titan", "Beast Titan"],
            answer: "Attack Titan",
            difficulty: "Medium"
        },
        {
            question: "Who is known as 'Humanity's Strongest Soldier' in Attack on Titan?",
            options: ["Levi Ackerman", "Erwin Smith", "Mikasa Ackerman", "Eren Yeager"],
            answer: "Levi Ackerman",
            difficulty: "Medium"
        },
        {
            question: "What is the name of Eren's adoptive sister?",
            options: ["Mikasa Ackerman", "Historia Reiss", "Annie Leonhart", "Sasha Blouse"],
            answer: "Mikasa Ackerman",
            difficulty: "Medium"
        },
        {
            question: "What is the name of the military branch that fights Titans outside the walls?",
            options: ["Survey Corps", "Garrison", "Military Police", "Training Corps"],
            answer: "Survey Corps",
            difficulty: "Medium"
        },

        // My Hero Academia - Medium
        {
            question: "What is the name of the school in My Hero Academia?",
            options: ["U.A. High School", "Shiketsu High", "Ketsubutsu Academy", "Seiai Academy"],
            answer: "U.A. High School",
            difficulty: "Medium"
        },
        {
            question: "What is Todoroki's quirk called?",
            options: ["Half-Cold Half-Hot", "Ice Fire", "Temperature Control", "Dual Element"],
            answer: "Half-Cold Half-Hot",
            difficulty: "Medium"
        },
        {
            question: "Who is the principal of U.A. High School?",
            options: ["Nezu", "All Might", "Aizawa", "Present Mic"],
            answer: "Nezu",
            difficulty: "Medium"
        },
        {
            question: "What is Iida's quirk called?",
            options: ["Engine", "Speed", "Turbo", "Rocket"],
            answer: "Engine",
            difficulty: "Medium"
        },

        // Death Note - Medium
        {
            question: "What is the name of Light Yagami's Shinigami in Death Note?",
            options: ["Ryuk", "Rem", "Sidoh", "Gelus"],
            answer: "Ryuk",
            difficulty: "Medium"
        },
        {
            question: "What is L's real name?",
            options: ["L Lawliet", "Light Yagami", "Mello", "Near"],
            answer: "L Lawliet",
            difficulty: "Medium"
        },

        // Demon Slayer - Medium
        {
            question: "What is the name of Tanjiro's sword style?",
            options: ["Water Breathing", "Flame Breathing", "Thunder Breathing", "Wind Breathing"],
            answer: "Water Breathing",
            difficulty: "Medium"
        },
        {
            question: "What is Zenitsu's breathing technique?",
            options: ["Thunder Breathing", "Water Breathing", "Fire Breathing", "Wind Breathing"],
            answer: "Thunder Breathing",
            difficulty: "Medium"
        },

        // Fullmetal Alchemist - Medium
        {
            question: "In Fullmetal Alchemist, what is the first law of equivalent exchange?",
            options: ["To obtain something, something of equal value must be lost", "Energy cannot be created or destroyed", "Matter can be changed but not created", "All things are connected"],
            answer: "To obtain something, something of equal value must be lost",
            difficulty: "Medium"
        },
        {
            question: "What is Edward Elric's nickname?",
            options: ["Fullmetal Alchemist", "Steel Alchemist", "Iron Alchemist", "Metal Alchemist"],
            answer: "Fullmetal Alchemist",
            difficulty: "Medium"
        },

        // JoJo's Bizarre Adventure - Medium
        {
            question: "In JoJo's Bizarre Adventure, what are the supernatural abilities called?",
            options: ["Stands", "Personas", "Spirits", "Phantoms"],
            answer: "Stands",
            difficulty: "Medium"
        },

        // Hunter x Hunter - Medium
        {
            question: "What is the currency used in the Hunter x Hunter world?",
            options: ["Jenny", "Berry", "Zeni", "Beli"],
            answer: "Jenny",
            difficulty: "Medium"
        },

        // Tokyo Ghoul - Medium
        {
            question: "In Tokyo Ghoul, what do ghouls primarily eat?",
            options: ["Human flesh", "Blood", "Souls", "Energy"],
            answer: "Human flesh",
            difficulty: "Medium"
        },
    ],

    Hard: [
        // One Piece - Hard
        {
            question: "What are the ancient stones that Nico Robin can read called?",
            options: ["Poneglyphs", "Road Stones", "Ancient Tablets", "Historia Stones"],
            answer: "Poneglyphs",
            difficulty: "Hard"
        },
        {
            question: "Who was Nico Robin's mentor on Ohara?",
            options: ["Professor Clover", "Dr. Hiriluk", "Professor Oak", "Dr. Vegapunk"],
            answer: "Professor Clover",
            difficulty: "Hard"
        },
        {
            question: "What is the name of the prison where Ace was held before his execution?",
            options: ["Impel Down", "Enies Lobby", "Marine Headquarters", "Sabaody"],
            answer: "Impel Down",
            difficulty: "Hard"
        },
        {
            question: "In One Piece, where do the Straw Hats first meet Brook?",
            options: ["Thriller Bark", "Sabaody Archipelago", "Water 7", "Enies Lobby"],
            answer: "Thriller Bark",
            difficulty: "Hard"
        },
        {
            question: "What is the name of the island where the final battle takes place in One Piece's Marineford Arc?",
            options: ["Marineford", "Marine Base", "Navy Island", "Justice Island"],
            answer: "Marineford",
            difficulty: "Hard"
        },
        {
            question: "What is the name of Usopp's father?",
            options: ["Yasopp", "Shanks", "Benn Beckman", "Lucky Roux"],
            answer: "Yasopp",
            difficulty: "Hard"
        },

        // Naruto - Hard
        {
            question: "In Naruto, what is the name of the organization that Itachi belongs to?",
            options: ["Akatsuki", "Anbu", "Root", "Sound Four"],
            answer: "Akatsuki",
            difficulty: "Hard"
        },
        {
            question: "What is the name of the village where the Uchiha massacre took place?",
            options: ["Hidden Leaf Village", "Hidden Mist Village", "Hidden Sand Village", "Hidden Stone Village"],
            answer: "Hidden Leaf Village",
            difficulty: "Hard"
        },
        {
            question: "What is the name of the technique that Minato Namikaze is famous for?",
            options: ["Flying Thunder God Technique", "Rasengan", "Shadow Clone Jutsu", "Chidori"],
            answer: "Flying Thunder God Technique",
            difficulty: "Hard"
        },
        {
            question: "What is the real name of the leader of the Akatsuki?",
            options: ["Nagato", "Yahiko", "Konan", "Obito"],
            answer: "Nagato",
            difficulty: "Hard"
        },

        // Dragon Ball - Hard
        {
            question: "What is the name of the ultimate technique in Dragon Ball that Goku learns from King Kai?",
            options: ["Spirit Bomb", "Kamehameha", "Instant Transmission", "Dragon Fist"],
            answer: "Spirit Bomb",
            difficulty: "Hard"
        },
        {
            question: "What is the name of the technique Goku uses to teleport in Dragon Ball Z?",
            options: ["Instant Transmission", "Teleportation", "Space Jump", "Dimension Shift"],
            answer: "Instant Transmission",
            difficulty: "Hard"
        },
        {
            question: "What is the name of the first villain in Dragon Ball Z?",
            options: ["Raditz", "Vegeta", "Nappa", "Frieza"],
            answer: "Raditz",
            difficulty: "Hard"
        },

        // Attack on Titan - Hard
        {
            question: "In Attack on Titan, what is the name of the serum that turns people into Titans?",
            options: ["Titan Serum", "Founding Serum", "Beast Serum", "Colossal Serum"],
            answer: "Titan Serum",
            difficulty: "Hard"
        },
        {
            question: "What is the name of Eren's half-brother?",
            options: ["Zeke Yeager", "Reiner Braun", "Bertholdt Hoover", "Marcel Galliard"],
            answer: "Zeke Yeager",
            difficulty: "Hard"
        },
        {
            question: "What is the name of the country that contains the walls in Attack on Titan?",
            options: ["Paradis Island", "Marley", "Eldia", "Hizuru"],
            answer: "Paradis Island",
            difficulty: "Hard"
        },

        // My Hero Academia - Hard
        {
            question: "What is the name of All Might's quirk?",
            options: ["One For All", "All For One", "Super Strength", "Symbol of Peace"],
            answer: "One For All",
            difficulty: "Hard"
        },
        {
            question: "What is the name of the main villain in My Hero Academia?",
            options: ["All For One", "Shigaraki", "Overhaul", "Stain"],
            answer: "All For One",
            difficulty: "Hard"
        },
        {
            question: "What is Eraserhead's real name?",
            options: ["Shota Aizawa", "Hizashi Yamada", "Toshinori Yagi", "Kenji Tsuragamae"],
            answer: "Shota Aizawa",
            difficulty: "Hard"
        },

        // Death Note - Hard
        {
            question: "What is the name of the organization that L works for?",
            options: ["Wammy's House", "Interpol", "FBI", "NPA"],
            answer: "Wammy's House",
            difficulty: "Hard"
        },
        {
            question: "How many days does Light have to live after touching the Death Note?",
            options: ["No time limit", "365 days", "100 days", "30 days"],
            answer: "No time limit",
            difficulty: "Hard"
        },

        // Fullmetal Alchemist - Hard
        {
            question: "In Fullmetal Alchemist Brotherhood, what is the name of the country where the story takes place?",
            options: ["Amestris", "Xerxes", "Drachma", "Creta"],
            answer: "Amestris",
            difficulty: "Hard"
        },
        {
            question: "What is the name of the technique that allows Edward Elric to perform alchemy without a transmutation circle?",
            options: ["Clap Alchemy", "Truth Alchemy", "Philosopher's Alchemy", "Gate Alchemy"],
            answer: "Clap Alchemy",
            difficulty: "Hard"
        },
        {
            question: "What is the name of the Homunculus that represents Pride?",
            options: ["Selim Bradley", "King Bradley", "Greed", "Envy"],
            answer: "Selim Bradley",
            difficulty: "Hard"
        },

        // JoJo's Bizarre Adventure - Hard
        {
            question: "In JoJo's Bizarre Adventure: Stardust Crusaders, what is the name of DIO's Stand?",
            options: ["The World", "Star Platinum", "Crazy Diamond", "Gold Experience"],
            answer: "The World",
            difficulty: "Hard"
        },
        {
            question: "What is the name of Jotaro's Stand?",
            options: ["Star Platinum", "The World", "Crazy Diamond", "Gold Experience"],
            answer: "Star Platinum",
            difficulty: "Hard"
        },

        // Hunter x Hunter - Hard
        {
            question: "In Hunter x Hunter, what is Gon's father's name?",
            options: ["Ging Freecss", "Silva Zoldyck", "Isaac Netero", "Leorio Paradinight"],
            answer: "Ging Freecss",
            difficulty: "Hard"
        },
        {
            question: "What is the name of the exam that determines who becomes a Hunter in Hunter x Hunter?",
            options: ["Hunter Exam", "License Test", "Qualification Trial", "Selection Challenge"],
            answer: "Hunter Exam",
            difficulty: "Hard"
        },
        {
            question: "What is Killua's family's profession?",
            options: ["Assassins", "Hunters", "Bodyguards", "Mercenaries"],
            answer: "Assassins",
            difficulty: "Hard"
        },

        // Bleach - Hard
        {
            question: "In Bleach, what is the name of Ichigo's Zanpakuto?",
            options: ["Zangetsu", "Senbonzakura", "Hyorinmaru", "Zabimaru"],
            answer: "Zangetsu",
            difficulty: "Hard"
        },
        {
            question: "What is the name of the organization that Ichigo joins?",
            options: ["Soul Society", "Gotei 13", "Quincy", "Arrancar"],
            answer: "Gotei 13",
            difficulty: "Hard"
        },

        // Code Geass - Hard
        {
            question: "In Code Geass, what is the name of Lelouch's Geass power?",
            options: ["The Power of Absolute Obedience", "Mind Control", "Command Geass", "Royal Authority"],
            answer: "The Power of Absolute Obedience",
            difficulty: "Hard"
        },
        {
            question: "What is Lelouch's alter ego called?",
            options: ["Zero", "Emperor", "Black Prince", "Demon"],
            answer: "Zero",
            difficulty: "Hard"
        },

        // Demon Slayer - Hard
        {
            question: "What is the name of the organization that Tanjiro joins?",
            options: ["Demon Slayer Corps", "Hashira", "Pillar Corps", "Slayer Guild"],
            answer: "Demon Slayer Corps",
            difficulty: "Hard"
        },
        {
            question: "What is the name of the strongest demons after Muzan?",
            options: ["Twelve Kizuki", "Upper Moons", "Demon Lords", "Elite Demons"],
            answer: "Twelve Kizuki",
            difficulty: "Hard"
        },

        // One Punch Man - Hard
        {
            question: "What is the name of the hero association's top hero before Saitama?",
            options: ["Blast", "Tornado", "Bang", "King"],
            answer: "Blast",
            difficulty: "Hard"
        },

        // Mob Psycho 100 - Hard
        {
            question: "What is Mob's real name?",
            options: ["Shigeo Kageyama", "Ritsu Kageyama", "Arataka Reigen", "Teruki Hanazawa"],
            answer: "Shigeo Kageyama",
            difficulty: "Hard"
        },

        // Tokyo Ghoul - Hard
        {
            question: "What is the name of Ken Kaneki's ghoul mask organization?",
            options: ["Anteiku", "Aogiri Tree", "CCG", "Goat"],
            answer: "Anteiku",
            difficulty: "Hard"
        },

        // Jujutsu Kaisen - Hard
        {
            question: "What is the name of Yuji Itadori's cursed technique?",
            options: ["He doesn't have one initially", "Divergent Fist", "Black Flash", "Sukuna's Malevolent Shrine"],
            answer: "He doesn't have one initially",
            difficulty: "Hard"
        },
        {
            question: "What is the name of the King of Curses?",
            options: ["Ryomen Sukuna", "Mahito", "Jogo", "Hanami"],
            answer: "Ryomen Sukuna",
            difficulty: "Hard"
        },

        // Fire Force - Hard
        {
            question: "What is the name of Shinra's fire ability?",
            options: ["Devil's Footprints", "Fire Step", "Infernal Step", "Flame Feet"],
            answer: "Devil's Footprints",
            difficulty: "Hard"
        },

        // Black Clover - Hard
        {
            question: "What is Asta's anti-magic sword called?",
            options: ["Demon-Slayer Sword", "Anti-Magic Sword", "Devil Sword", "Grimoire Sword"],
            answer: "Demon-Slayer Sword",
            difficulty: "Hard"
        },

        // Seven Deadly Sins - Hard
        {
            question: "What is Meliodas's sin?",
            options: ["Wrath", "Pride", "Greed", "Envy"],
            answer: "Wrath",
            difficulty: "Hard"
        },

        // Overlord - Hard
        {
            question: "What is Ainz Ooal Gown's real name in the real world?",
            options: ["Suzuki Satoru", "Momonga", "Touch Me", "Ulbert Alain Odle"],
            answer: "Suzuki Satoru",
            difficulty: "Hard"
        },

        // Re:Zero - Hard
        {
            question: "What is Subaru's special ability called?",
            options: ["Return by Death", "Resurrection", "Time Loop", "Death Rewind"],
            answer: "Return by Death",
            difficulty: "Hard"
        },

        // Steins;Gate - Hard
        {
            question: "What is the name of the time machine in Steins;Gate?",
            options: ["Phone Microwave", "Time Leap Machine", "D-Mail Device", "Divergence Meter"],
            answer: "Phone Microwave",
            difficulty: "Hard"
        }
    ]
};

module.exports = { FALLBACK_QUESTIONS };
