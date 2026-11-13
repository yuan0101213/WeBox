package com.webox;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.webox.service.PriceCalculator;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PriceCalculatorTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final String groups = """
      [{"id":"base","name":"Base","minSelect":1,"maxSelect":1,"options":[{"id":"rice","name":"Rice","extraPriceFen":0}]},
       {"id":"extras","name":"Extras","minSelect":0,"maxSelect":2,"options":[{"id":"cheese","name":"Cheese","extraPriceFen":300}]}]
      """;
    @Test void addsSelectedOptionsInIntegerFen() throws Exception {
        var selected = mapper.readTree("[{\"groupId\":\"base\",\"optionId\":\"rice\"},{\"groupId\":\"extras\",\"optionId\":\"cheese\"}]");
        var price = PriceCalculator.calculate(2250, mapper.readTree(groups), selected);
        assertEquals(2550, price.unitPriceFen());
        assertEquals("Cheese", price.options().get(1).get("name").asText());
    }
    @Test void rejectsMissingRequiredGroup() throws Exception {
        assertThrows(RuntimeException.class, () -> PriceCalculator.calculate(2250, mapper.readTree(groups), mapper.readTree("[]")));
    }
    @Test void rejectsForeignAndDuplicateOptions() throws Exception {
        assertThrows(RuntimeException.class, () -> PriceCalculator.calculate(2250, mapper.readTree(groups), mapper.readTree("[{\"groupId\":\"base\",\"optionId\":\"fake\"}]")));
        assertThrows(RuntimeException.class, () -> PriceCalculator.calculate(2250, mapper.readTree(groups), mapper.readTree("[{\"groupId\":\"base\",\"optionId\":\"rice\"},{\"groupId\":\"base\",\"optionId\":\"rice\"}]")));
    }
}
