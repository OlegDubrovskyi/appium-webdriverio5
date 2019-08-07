export function getRandomValue(min, max) {
    const randomNumber = min + Math.random() * (max - min);
    return Math.round(randomNumber);
}
