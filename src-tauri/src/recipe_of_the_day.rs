use chrono::Datelike;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RecipeOfDay {
    pub name: String,
    pub category: String,
    pub thumbnail_url: Option<String>,
    pub ingredients: Vec<String>,
    pub instructions: String,
    pub source_url: Option<String>,
}

// TheMealDB's "Vegan" category is the only one that's actually vegan - its
// other categories (including "Vegetarian") aren't reliably free of animal
// products, so the non-vegan side rotates through a fixed set of ordinary
// categories instead of trying to guess at every meal's ingredients.
const VEGAN_CATEGORIES: &[&str] = &["Vegan"];
const NON_VEGAN_CATEGORIES: &[&str] = &["Beef", "Chicken", "Pasta", "Seafood", "Dessert", "Pork"];

/// Same stable-for-the-day / rolls-over-at-UTC-midnight pattern as
/// spotify.rs's `today_seed`/`pick_index` (song of the day) - kept as its
/// own small copy rather than a shared util, same as every other module
/// here stays self-contained.
fn today_seed() -> i32 {
    chrono::Utc::now().date_naive().num_days_from_ce()
}

fn pick_index(len: usize, seed: i32) -> Option<usize> {
    if len == 0 {
        return None;
    }
    Some(seed.rem_euclid(len as i32) as usize)
}

#[derive(Debug, Deserialize)]
struct FilterMeal {
    #[serde(rename = "idMeal")]
    id_meal: String,
}

#[derive(Debug, Deserialize)]
struct FilterResponse {
    meals: Option<Vec<FilterMeal>>,
}

#[derive(Debug, Deserialize)]
struct LookupMeal {
    #[serde(rename = "strMeal")]
    str_meal: String,
    #[serde(rename = "strCategory")]
    str_category: Option<String>,
    #[serde(rename = "strMealThumb")]
    str_meal_thumb: Option<String>,
    #[serde(rename = "strInstructions")]
    str_instructions: Option<String>,
    #[serde(rename = "strSource")]
    str_source: Option<String>,
    // TheMealDB spreads ingredients/measures across 20 numbered fields
    // (strIngredient1..20, strMeasure1..20) instead of an array - flattening
    // into a map avoids declaring 40 near-identical struct fields.
    #[serde(flatten)]
    fields: HashMap<String, Option<String>>,
}

#[derive(Debug, Deserialize)]
struct LookupResponse {
    meals: Option<Vec<LookupMeal>>,
}

fn build_ingredients(meal: &LookupMeal) -> Vec<String> {
    (1..=20)
        .filter_map(|i| {
            let ingredient = meal.fields.get(&format!("strIngredient{i}"))?.as_deref()?.trim();
            if ingredient.is_empty() {
                return None;
            }
            let measure = meal
                .fields
                .get(&format!("strMeasure{i}"))
                .and_then(|m| m.as_deref())
                .map(str::trim)
                .filter(|m| !m.is_empty());
            Some(match measure {
                Some(measure) => format!("{measure} {ingredient}"),
                None => ingredient.to_string(),
            })
        })
        .collect()
}

fn meal_to_recipe(meal: LookupMeal) -> RecipeOfDay {
    RecipeOfDay {
        name: meal.str_meal.clone(),
        category: meal.str_category.clone().unwrap_or_default(),
        thumbnail_url: meal.str_meal_thumb.clone(),
        ingredients: build_ingredients(&meal),
        instructions: meal.str_instructions.clone().unwrap_or_default(),
        source_url: meal.str_source.clone().filter(|s| !s.is_empty()),
    }
}

async fn meal_ids_for_category(client: &reqwest::Client, category: &str) -> Vec<String> {
    let url = format!("https://www.themealdb.com/api/json/v1/1/filter.php?c={category}");
    let Ok(response) = client.get(&url).send().await else {
        return Vec::new();
    };
    let Ok(body) = response.text().await else {
        return Vec::new();
    };
    serde_json::from_str::<FilterResponse>(&body)
        .ok()
        .and_then(|r| r.meals)
        .unwrap_or_default()
        .into_iter()
        .map(|m| m.id_meal)
        .collect()
}

async fn lookup_meal(client: &reqwest::Client, id: &str) -> Option<RecipeOfDay> {
    let url = format!("https://www.themealdb.com/api/json/v1/1/lookup.php?i={id}");
    let response = client.get(&url).send().await.ok()?;
    let body = response.text().await.ok()?;
    let parsed = serde_json::from_str::<LookupResponse>(&body).ok()?;
    let meal = parsed.meals?.into_iter().next()?;
    Some(meal_to_recipe(meal))
}

/// TheMealDB (free, keyless) - today's category (from the vegan or
/// non-vegan rotation, per the widget's toggle) and today's meal within it
/// are both seeded off the date via `today_seed`/`pick_index`, so the pick
/// is stable all day and changes tomorrow, same as Spotify's song of the
/// day. `None` covers any request failure the same way `of_the_day::fetch`
/// does - the widget just shows that section as empty rather than erroring
/// the whole response.
pub async fn fetch(client: &reqwest::Client, vegan: bool) -> Option<RecipeOfDay> {
    let seed = today_seed();
    let categories: &[&str] = if vegan { VEGAN_CATEGORIES } else { NON_VEGAN_CATEGORIES };
    let category = categories[pick_index(categories.len(), seed)?];

    let meal_ids = meal_ids_for_category(client, category).await;
    let meal_id = meal_ids.get(pick_index(meal_ids.len(), seed)?)?;

    lookup_meal(client, meal_id).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pick_index_wraps_within_bounds_and_is_deterministic() {
        assert_eq!(pick_index(0, 42), None);
        assert_eq!(pick_index(5, 0), Some(0));
        assert_eq!(pick_index(5, 5), Some(0));
        assert_eq!(pick_index(5, 7), pick_index(5, 7));
    }

    #[test]
    fn build_ingredients_pairs_measure_with_ingredient_and_skips_blanks() {
        let mut fields = HashMap::new();
        fields.insert("strIngredient1".to_string(), Some("Flour".to_string()));
        fields.insert("strMeasure1".to_string(), Some("2 cups".to_string()));
        fields.insert("strIngredient2".to_string(), Some("".to_string()));
        fields.insert("strMeasure2".to_string(), Some("1 tbsp".to_string()));
        fields.insert("strIngredient3".to_string(), Some("Salt".to_string()));
        fields.insert("strMeasure3".to_string(), None);

        let meal = LookupMeal {
            str_meal: "Test".to_string(),
            str_category: None,
            str_meal_thumb: None,
            str_instructions: None,
            str_source: None,
            fields,
        };

        assert_eq!(build_ingredients(&meal), vec!["2 cups Flour".to_string(), "Salt".to_string()]);
    }
}
