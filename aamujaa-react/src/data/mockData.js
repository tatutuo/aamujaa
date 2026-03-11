export const mockGames = [
  {
    id: 1,
    homeTeam: "FLA",
    awayTeam: "BOS",
    homeScore: 3,
    awayScore: 2,
    gameState: "LIVE",
    period: "3rd",
    clock: "12:45"
  },
  {
    id: 2,
    homeTeam: "CAR",
    awayTeam: "TBL",
    homeScore: undefined,
    awayScore: undefined,
    gameState: "PRE",
    startTime: "02:00"
  },
  {
    id: 3,
    homeTeam: "DAL",
    awayTeam: "COL",
    homeScore: 4,
    awayScore: 1,
    gameState: "FINAL"
  }
];

export const mockPlayers = [
  {
    id: 8477493,
    firstName: "Aleksander",
    lastName: "Barkov",
    team: "FLA",
    position: "C",
    goals: 1,
    assists: 2,
    shots: 4,
    plusMinus: 2,
    toi: "21:15"
  },
  {
    id: 8478427,
    firstName: "Sebastian",
    lastName: "Aho",
    team: "CAR",
    position: "C",
    goals: 0,
    assists: 0,
    shots: 2,
    plusMinus: -1,
    toi: "19:30"
  },
  {
    id: 8478420,
    firstName: "Mikko",
    lastName: "Rantanen",
    team: "COL",
    position: "RW",
    goals: 2,
    assists: 0,
    shots: 6,
    plusMinus: 1,
    toi: "23:45"
  }
];

export const mockPlayerDetails = {
    id: 8477493,
    firstName: "Aleksander",
    lastName: "Barkov",
    sweaterNumber: 16,
    position: "C",
    teamAbbrev: "FLA",
    teamName: "Florida Panthers",
    teamLogo: "https://assets.nhle.com/logos/nhl/svg/FLA_light.svg",
    headshot: "https://assets.nhle.com/mugs/nhl/latest/backgroundless/256/8477493.png",
    height: "191",
    weight: "97",
    birthCountry: "FIN",
    isFavorite: true,
    isFantasy: true,
    stats: {
        thisSeason: { goals: 23, assists: 57, points: 80, gamesPlayed: 73 },
        career: { goals: 266, assists: 445, points: 711, gamesPlayed: 737 }
    },
    seasons: [
        { season: "25-26", team: "Florida Panthers", gp: 73, g: 23, a: 57, p: 80 },
        { season: "24-25", team: "Florida Panthers", gp: 68, g: 23, a: 55, p: 78 },
        { season: "23-24", team: "Florida Panthers", gp: 67, g: 39, a: 49, p: 88 }
    ]
};

export const mockTeamDetails = {
    abbrev: "FLA",
    name: "Florida Panthers",
    logo: "https://assets.nhle.com/logos/nhl/svg/FLA_light.svg",
    isFavorite: true,
    games: [
        { id: 101, date: "2.3.", opponent: "BOS", opponentLogo: "https://assets.nhle.com/logos/nhl/svg/BOS_light.svg", isHome: true, teamScore: 3, oppScore: 2, status: "FINAL" },
        { id: 102, date: "28.2.", opponent: "TBL", opponentLogo: "https://assets.nhle.com/logos/nhl/svg/TBL_light.svg", isHome: false, teamScore: 1, oppScore: 4, status: "FINAL" },
        { id: 103, date: "4.3.", opponent: "NYR", opponentLogo: "https://assets.nhle.com/logos/nhl/svg/NYR_light.svg", isHome: true, teamScore: null, oppScore: null, status: "FUT" }
    ],
    latestRoster: {
        forwards: ["#16 Barkov", "#13 Reinhart", "#19 Tkachuk", "#23 Verhaeghe", "#15 Lundell", "#27 Luostarinen"],
        defense: ["#42 Forsling", "#5 Ekblad", "#77 Mikkola", "#7 Kulikov"],
        goalies: ["#72 Bobrovsky", "#41 Stolarz"]
    }
};

export const mockStandings = {
    eastern: [
        { teamAbbrev: { default: "FLA" }, divisionName: "Atlantic", gamesPlayed: 73, wins: 46, losses: 21, otLosses: 6, points: 98, goalDifferential: 45 },
        { teamAbbrev: { default: "BOS" }, divisionName: "Atlantic", gamesPlayed: 74, wins: 42, losses: 17, otLosses: 15, points: 99, goalDifferential: 38 },
        { teamAbbrev: { default: "NYR" }, divisionName: "Metropolitan", gamesPlayed: 73, wins: 48, losses: 20, otLosses: 5, points: 101, goalDifferential: 50 },
        { teamAbbrev: { default: "CAR" }, divisionName: "Metropolitan", gamesPlayed: 74, wins: 45, losses: 21, otLosses: 8, points: 98, goalDifferential: 40 },
    ],
    western: [
        { teamAbbrev: { default: "DAL" }, divisionName: "Central", gamesPlayed: 74, wins: 45, losses: 19, otLosses: 10, points: 100, goalDifferential: 48 },
        { teamAbbrev: { default: "COL" }, divisionName: "Central", gamesPlayed: 73, wins: 45, losses: 22, otLosses: 6, points: 96, goalDifferential: 55 },
        { teamAbbrev: { default: "VAN" }, divisionName: "Pacific", gamesPlayed: 73, wins: 45, losses: 19, otLosses: 9, points: 99, goalDifferential: 52 },
        { teamAbbrev: { default: "VGK" }, divisionName: "Pacific", gamesPlayed: 73, wins: 41, losses: 25, otLosses: 7, points: 89, goalDifferential: 20 },
    ]
};

export const mockSchedule = {
    dates: ["2.3.", "3.3.", "4.3.", "5.3.", "6.3.", "7.3.", "8.3."],
    teams: [
        {
            abbrev: "FLA",
            logo: "https://assets.nhle.com/logos/nhl/svg/FLA_light.svg",
            gamesCount: 4, 
            homeGames: 2, 
            awayGames: 2,
            schedule: {
                "2.3.": { isHome: true, opponent: "BOS" },
                "3.3.": null,
                "4.3.": { isHome: true, opponent: "NYR" },
                "5.3.": null,
                "6.3.": { isHome: false, opponent: "TBL" },
                "7.3.": null,
                "8.3.": { isHome: false, opponent: "CAR" }
            }
        },
        {
            abbrev: "BOS",
            logo: "https://assets.nhle.com/logos/nhl/svg/BOS_light.svg",
            gamesCount: 3, 
            homeGames: 1, 
            awayGames: 2,
            schedule: {
                "2.3.": { isHome: false, opponent: "FLA" },
                "3.3.": null,
                "4.3.": null,
                "5.3.": { isHome: true, opponent: "TOR" },
                "6.3.": null,
                "7.3.": { isHome: false, opponent: "NYR" },
                "8.3.": null
            }
        }
    ]
};