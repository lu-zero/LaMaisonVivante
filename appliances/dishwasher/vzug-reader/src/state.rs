use crate::unit::*;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Consumption {
    pub power: Kwh,
    pub water: Liter,
}

#[derive(Debug, Serialize)]
pub struct State {
    pub average_consumption: Consumption,
    pub total_consumption: Consumption,
}
