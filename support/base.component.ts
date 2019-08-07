const timeout = 10000;

export class BaseComponent {
    safeClick(element: WebdriverIO.Element) {
        element.waitForDisplayed(timeout);
        element.click();
    }

    sendKeys(element: WebdriverIO.Element, value: any) {
        element.waitForDisplayed(timeout);
        element.clearValue();
        element.addValue(value);
    }

    safeClickByFirst(element: WebdriverIO.Element[]) {
        element[0].waitForDisplayed(timeout);
        element[0].click();
    }

    assertElementVisible(element: WebdriverIO.Element) {
        element.waitForDisplayed(timeout);
        expect(element.isDisplayed).toBeTruthy();
    }

    assertFirstElementVisible(element: WebdriverIO.Element[]) {
        element[0].waitForDisplayed(timeout);
        expect(element[0].isDisplayed).toBeTruthy();
    }

    assertElementContainsText(element: WebdriverIO.Element, text: string) {
        expect(element.getText()).toContain(text);
    }

    scrollByDirection(direction: string) {
        const windowSize: object = browser.getWindowSize();
        // @ts-ignore
        let fromTo: object = {from: { x: windowSize.width * 0.14, y: windowSize.height * 0.67}, to: {x: windowSize.width * 0.14, y: windowSize.height * 0.3}};
        //@ts-ignore
        if ((direction !== 'down')) {let from = fromTo.from; fromTo.from =  fromTo.to; fromTo.to = from;}
        $('android.widget.FrameLayout').touchAction([
            // @ts-ignore
            {action: 'press', x: fromTo.from.x, y: fromTo.from.y}, {action: 'wait', ms: 1000}, {action: 'moveTo', x: fromTo.from.x, y: fromTo.to.y}, {action: 'release'}
        ]);
    }
}
