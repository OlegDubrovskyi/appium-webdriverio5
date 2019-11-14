const timeout = 50000;

export class BaseComponent {
    safeClick(element: WebdriverIO.Element) {
        element.waitForDisplayed(timeout);
        element.click();
        return this;
    }

    sendKeys(element: WebdriverIO.Element, value: any) {
        element.waitForDisplayed(timeout);
        this.safeClick(element);
        element.setValue(value);
        return this;
    }

    safeClickByFirst(element: WebdriverIO.Element[]) {
        element[0].waitForDisplayed(timeout);
        element[0].click();
    }

    assertElementVisible(element: WebdriverIO.Element) {
        element.waitForDisplayed(timeout);
        expect(element.isDisplayed).toBeTruthy();
        return this;
    }

    assertElementNotVisible(element: WebdriverIO.Element) {
        browser.pause(1000);
        try {
            if (element.isDisplayed()) {
                expect(element.isDisplayed).toBeFalsy();
            }
        } catch (error){}
        return this;
    }

    assertFirstElementVisible(element: WebdriverIO.Element[]) {
        element[0].waitForDisplayed(timeout);
        expect(element[0].isDisplayed).toBeTruthy();
        return this;
    }

    assertElementContainsText(element: WebdriverIO.Element, text: string) {
        element.waitForDisplayed(timeout);
        expect(element.getText().toLowerCase()).toContain(text.toLowerCase());
        return this;
    }

    assertElementNotContainsText(element: WebdriverIO.Element, text: string) {
        const expectedValue = element.getText().toLowerCase();
        const previousValue = text.toLowerCase();
        expect(expectedValue !== previousValue).toBeTruthy('Expected value "' + expectedValue.toUpperCase() + '" should not be equal to "' + previousValue.toUpperCase() + '"');
        return this;
    }

    scrollByDirection(direction: string) {
        const windowSize: object = browser._getWindowSize();
        // @ts-ignore
        const fromTo: object = {from: { x: windowSize.width * 0.14, y: windowSize.height * 0.67}, to: {x: windowSize.width * 0.14, y: windowSize.height * 0.3}};
        // @ts-ignore
        if ((direction !== 'down')) {const from = fromTo.from; fromTo.from =  fromTo.to; fromTo.to = from; }
        $('android.widget.FrameLayout').touchAction([
            // @ts-ignore
            {action: 'press', x: fromTo.from.x, y: fromTo.from.y}, {action: 'wait', ms: 1000}, {action: 'moveTo', x: fromTo.from.x, y: fromTo.to.y}, {action: 'release'},
        ]);
    }

    swipeFromTo(from, to) {
        browser.touchPerform([{
            action: 'press',
            options: from,
        }, {
            action: 'wait',
            options: { ms: 1000 },
        }, {
            action: 'moveTo',
            options: to,
        }, {
            action: 'release',
        }]);
        browser.pause(1000);
    }

    scrollToElement(element: WebdriverIO.Element, direction) {
        let from;
        let to;
        switch (direction) {
            case 'down':
                from = {x : 0, y : 100};
                to = {x : 0, y : -300};
                break;
            case 'top':
                from = {x : 0, y : 600};
                to = {x:  0, y : 900};
                break;
        }
        for (let i = 0; i < 10; i++) {
            if (element.isDisplayed) {
                break;
            }
            this.swipeFromTo(from, to);
        }
    }
