package fennel

import (
	"testing"

	"github.com/stretchr/testify/assert"
	lua "github.com/yuin/gopher-lua"
)

func TestPool(t *testing.T) {
	p := NewPool()
	L := p.Get()
	assert.NotNil(t, L)

	// Verify fennel is loaded
	fennel := L.GetGlobal("fennel")
	assert.Equal(t, lua.LTTable, fennel.Type())

	p.Put(L)
}

func TestCompile(t *testing.T) {
	p := NewPool()
	L := p.Get()
	defer p.Put(L)

	script := "(fn add [a b] (+ a b))"
	compiled, err := Compile(L, script)
	assert.NoError(t, err)
	assert.Contains(t, compiled, "return (a + b)")
}

func TestEvalWithOutput(t *testing.T) {
	p := NewPool()
	L := p.Get()
	defer p.Put(L)

	t.Run("Stdout", func(t *testing.T) {
		script := `(do (print "hello") (print "world") 42)`
		val, stdout, stderr, err := EvalWithOutput(L, script)
		assert.NoError(t, err)
		assert.Equal(t, float64(42), MapToGo(val))
		assert.Equal(t, "hello\nworld\n", stdout)
		assert.Empty(t, stderr)
	})

	t.Run("Stderr", func(t *testing.T) {
		// Fennel macros or scripts might write to io.stderr
		script := `(io.stderr:write "error message")`
		_, stdout, stderr, err := EvalWithOutput(L, script)
		assert.NoError(t, err)
		assert.Empty(t, stdout)
		assert.Equal(t, "error message", stderr)
	})
}

func TestMapping(t *testing.T) {
	p := NewPool()
	L := p.Get()
	defer p.Put(L)

	tests := []struct {
		name string
		val  any
	}{
		{"nil", nil},
		{"bool", true},
		{"float", 3.14},
		{"string", "hello"},
		{"slice", []any{"a", "b", float64(1)}},
		{"map", map[string]any{"key": "val", "num": float64(123)}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lv := MapToLua(L, tt.val)
			back := MapToGo(lv)
			assert.Equal(t, tt.val, back)
		})
	}
}
