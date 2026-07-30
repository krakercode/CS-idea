use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Serialize, Clone)]
pub struct Suggestion {
    pub dimension: String,
    pub score: f64,
    pub title: String,
    pub tip: String,
    pub drills: Vec<String>,
}

struct DimensionInfo {
    key: &'static str,
    label: &'static str,
    title: &'static str,
    tip: &'static str,
    drills: &'static [&'static str],
}

const DIMENSIONS: &[DimensionInfo] = &[
    DimensionInfo {
        key: "aim",
        label: "Aim",
        title: "Sharpen your raw aim",
        tip: "Your aim rating is your weakest dimension. Prioritize crosshair placement and spray control over flashy movement.",
        drills: &[
            "Workshop: Aim Botz (headshot-only warmup, 10-15 min)",
            "Workshop: Recoil Master (spray patterns on your main rifle)",
            "Deathmatch with headshot-only kills for 15 minutes before ranked",
        ],
    },
    DimensionInfo {
        key: "positioning",
        label: "Positioning",
        title: "Improve your positioning",
        tip: "You're losing rating to positioning. Review demos for duels lost to bad angles or overextending after picks.",
        drills: &[
            "Watch back your last 2 losses and flag every death from a bad angle",
            "Practice holding off-angles on your main maps instead of default positions",
            "Review pro demos on your worst map for common holding spots",
        ],
    },
    DimensionInfo {
        key: "utility",
        label: "Utility",
        title: "Get more value from utility",
        tip: "Utility usage is your weakest area. Focus on lineups that trade for picks or space instead of wasted grenades.",
        drills: &[
            "Learn 3 smoke lineups and 3 flash lineups for your most-played map",
            "Workshop: Yprac Practice Maps (utility lineups + retake practice)",
            "Track your flash-assist and utility-damage stats per map for a week",
        ],
    },
    DimensionInfo {
        key: "clutch",
        label: "Clutch",
        title: "Build clutch consistency",
        tip: "Clutch rating is dragging you down. Slow down decision-making in 1vX situations instead of forcing quick peeks.",
        drills: &[
            "Workshop: Yprac Clutch/Retake scenarios",
            "Practice isolating one opponent at a time using sound cues before peeking",
            "Review lost clutch rounds for information you had but didn't use",
        ],
    },
    DimensionInfo {
        key: "opening",
        label: "Opening duels",
        title: "Win more opening duels",
        tip: "Your opening-duel impact is low. Work on taking duels on your terms rather than being forced into them.",
        drills: &[
            "Workshop: Aim Botz reflex/flick warmup before entry-fragging",
            "Practice pre-aiming common opening-duel angles on your main maps",
            "Review deaths in the first 20 seconds of rounds for avoidable duels",
        ],
    },
    DimensionInfo {
        key: "ct_leetify",
        label: "CT side",
        title: "Tighten up your CT side",
        tip: "Your CT-side rating is the weakest half. Focus on crossfires and trading teammates instead of solo holds.",
        drills: &[
            "Review CT-side losses for rounds lost to isolated 1v1s that should've been crossfires",
            "Practice default setups and rotations for your main maps",
        ],
    },
    DimensionInfo {
        key: "t_leetify",
        label: "T side",
        title: "Sharpen your T-side execs",
        tip: "Your T-side rating is the weakest half. Work on trading entries and committing to executes instead of passive play.",
        drills: &[
            "Review T-side rounds where you died without trading or being traded",
            "Practice 2-3 set executes with utility timing for your main maps",
        ],
    },
];

/// Given a Leetify `rating` object (aim/positioning/utility/clutch/opening/ct_leetify/t_leetify
/// scores), returns the weakest dimensions first, each paired with a curated tip. This is a
/// heuristic we built ourselves — Leetify's own "how to improve" coaching is not exposed via
/// the public API.
pub fn suggest(rating: &Value, limit: usize) -> Vec<Suggestion> {
    let mut scored: Vec<(f64, &DimensionInfo)> = DIMENSIONS
        .iter()
        .filter_map(|dim| {
            let score = rating.get(dim.key)?.as_f64()?;
            Some((score, dim))
        })
        .collect();

    scored.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

    scored
        .into_iter()
        .take(limit)
        .map(|(score, dim)| Suggestion {
            dimension: dim.label.to_string(),
            score,
            title: dim.title.to_string(),
            tip: dim.tip.to_string(),
            drills: dim.drills.iter().map(|s| s.to_string()).collect(),
        })
        .collect()
}
